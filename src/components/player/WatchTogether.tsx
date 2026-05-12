"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { WS_MSG } from "@/lib/ws-protocol";

// ── 类型定义 ──────────────────────────────────────
interface RoomMember {
  userId: number;
  email: string;
  isHost?: boolean;
}

interface RoomInfo {
  id: string;
  name: string;
  status: string;
  hostId: number;
  memberCount: number;
  members: RoomMember[];
}

interface ChatMessage {
  userId: number;
  email: string;
  text: string;
  timestamp: number;
}

type WatchRoomMessage = {
  type: string;
  payload: Record<string, unknown>;
};

interface WatchTogetherProps {
  seriesId: string;
  episodeId: string;
  /** 当前用户信息 */
  currentUserId?: number;
  currentEmail?: string;
  /** 收到同步指令时的回调 */
  onSyncPlay?: () => void;
  onSyncPause?: () => void;
  onSyncSeek?: (time: number) => void;
  onSyncEpisode?: (episodeId: string) => void;
  /** 播放器当前时间（用于房主同步） */
  currentTime: number;
}

/** 将 email 转为简短显示名 */
function emailToDisplayName(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;
  const local = email.slice(0, atIndex);
  return local.length > 8 ? local.slice(0, 6) + ".." : local;
}

/**
 * 一起看控制面板
 *
 * 支持：
 * - 创建/加入/离开房间
 * - 显示成员列表
 * - 房主播放状态同步
 * - 房间聊天
 */
const WatchTogether: React.FC<WatchTogetherProps> = ({
  seriesId,
  episodeId,
  currentUserId,
  currentEmail,
  onSyncPlay,
  onSyncPause,
  onSyncSeek,
  onSyncEpisode,
  currentTime,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const roomRef = useRef<RoomInfo | null>(null);
  const handleWsMessageRef = useRef<((msg: WatchRoomMessage) => void) | null>(
    null,
  );

  const isHost = useMemo(
    () => room?.hostId === currentUserId,
    [room, currentUserId],
  );

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // ── WebSocket 连接管理 ──────────────────────────
  const connectWs = useCallback(
    (roomId: string) => {
      if (!currentUserId || !currentEmail) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const configuredWsUrl = process.env.NEXT_PUBLIC_WS_URL;
      const wsBase = configuredWsUrl?.trim()
        ? configuredWsUrl
        : `${protocol}//${window.location.host}`;
      const wsUrl = `${wsBase.replace(/\/$/, "")}/ws/watch-room`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;
        // 加入房间
        ws.send(
          JSON.stringify({
            type: WS_MSG.JOIN,
            payload: { roomId },
          }),
        );

        // 启动心跳
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({ type: WS_MSG.HEARTBEAT, payload: {} }),
            );
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleWsMessageRef.current?.(msg);
        } catch {
          console.warn("[WatchTogether] 无法解析 WS 消息");
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        // 自动重连（指数退避，最多 5 次）
        if (roomRef.current && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 16000);
          reconnectAttemptsRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            connectWs(roomId);
          }, delay);
        }
      };

      ws.onerror = () => {
        setError("WebSocket 连接失败");
      };
    },
    [currentUserId, currentEmail],
  );

  const disconnectWs = useCallback(() => {
    reconnectAttemptsRef.current = 5; // 阻止自动重连
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    setWsConnected(false);
  }, []);

  // 消息自动滚动到底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // 清理
  useEffect(() => {
    return () => {
      disconnectWs();
    };
  }, [disconnectWs]);

  // 房主切集时自动同步给房间成员
  const prevEpisodeIdRef = useRef(episodeId);
  useEffect(() => {
    if (prevEpisodeIdRef.current !== episodeId) {
      prevEpisodeIdRef.current = episodeId;
      if (isHost && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: WS_MSG.SYNC,
            payload: {
              action: "episode_change",
              episodeId,
              currentTime: 0,
            },
          }),
        );
      }
    }
  }, [episodeId, isHost]);

  // ── WS 消息处理 ──────────────────────────────────
  const handleWsMessage = useCallback(
    (msg: WatchRoomMessage) => {
      switch (msg.type) {
        case WS_MSG.ROOM_STATE: {
          const members = msg.payload.members as RoomMember[];
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  memberCount: members.length,
                  members,
                }
              : prev,
          );
          break;
        }
        case WS_MSG.MEMBER_JOIN: {
          setRoom((prev) => {
            if (!prev) return prev;
            const newMember: RoomMember = {
              userId: msg.payload.userId as number,
              email: msg.payload.email as string,
            };
            // 避免重复
            if (prev.members.some((m) => m.userId === newMember.userId)) {
              return prev;
            }
            return {
              ...prev,
              memberCount: prev.memberCount + 1,
              members: [...prev.members, newMember],
            };
          });
          break;
        }
        case WS_MSG.MEMBER_LEAVE: {
          const leftUserId = msg.payload.userId as number;
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              memberCount: Math.max(0, prev.memberCount - 1),
              members: prev.members.filter(
                (m) => m.userId !== leftUserId,
              ),
            };
          });
          break;
        }
        case WS_MSG.PLAY_SYNC: {
          const action = msg.payload.action as string;
          const syncTime = msg.payload.currentTime as number;

          switch (action) {
            case "play":
              onSyncPlay?.();
              if (typeof syncTime === "number") onSyncSeek?.(syncTime);
              break;
            case "pause":
              onSyncPause?.();
              break;
            case "seek":
              if (typeof syncTime === "number") onSyncSeek?.(syncTime);
              break;
            case "episode_change":
              if (msg.payload.episodeId) {
                onSyncEpisode?.(String(msg.payload.episodeId));
              }
              break;
          }
          break;
        }
        case WS_MSG.CHAT_MSG: {
          setChatMessages((prev) => [
            ...prev.slice(-99), // 保留最近 100 条
            {
              userId: msg.payload.userId as number,
              email: msg.payload.email as string,
              text: msg.payload.text as string,
              timestamp: msg.payload.timestamp as number,
            },
          ]);
          break;
        }
        case WS_MSG.ERROR: {
          setError(msg.payload.message as string);
          setTimeout(() => setError(null), 3000);
          break;
        }
      }
    },
    [onSyncPlay, onSyncPause, onSyncSeek, onSyncEpisode],
  );

  useEffect(() => {
    handleWsMessageRef.current = handleWsMessage;
  }, [handleWsMessage]);

  // ── 房主同步操作 ──────────────────────────────────
  const sendSync = useCallback(
    (action: string, extra?: Record<string, unknown>) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: WS_MSG.SYNC,
          payload: {
            action,
            currentTime,
            ...extra,
          },
        }),
      );
    },
    [currentTime],
  );

  // ── API 操作 ──────────────────────────────────────
  const handleCreateRoom = async () => {
    if (!currentUserId) {
      setError("请先登录");
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetchWithCsrf("/api/watch-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: parseInt(seriesId, 10),
          episodeId: parseInt(episodeId, 10),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "创建失败");
      }
      const result = await res.json();
      setRoom(result.data);
      connectWs(result.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建房间失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    const roomId = joinRoomId.trim();
    if (!roomId || !currentUserId) return;
    setIsJoining(true);
    setError(null);
    try {
      const res = await fetchWithCsrf(`/api/watch-room/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "加入失败");
      }
      const result = await res.json();
      setRoom(result.data);
      setJoinRoomId("");
      connectWs(result.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入房间失败");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room) return;
    try {
      await fetchWithCsrf(`/api/watch-room/${room.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      });
    } catch {
      // 静默处理
    }
    disconnectWs();
    setRoom(null);
    setChatMessages([]);
  };

  const handleSendChat = () => {
    const text = chatText.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
      return;
    wsRef.current.send(
      JSON.stringify({
        type: WS_MSG.CHAT,
        payload: { text },
      }),
    );
    setChatText("");
  };

  // 复制房间 ID
  const copyRoomId = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.id);
      setError(null);
    } catch {
      // fallback
    }
  };

  if (!currentUserId) return null;

  return (
    <>
      {/* 一起看入口按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-2.5 text-[11px] font-bold transition-all sm:min-h-[44px] sm:px-3.5 sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${
          room
            ? "border-green-400/30 bg-green-500/15 text-green-300"
            : isOpen
              ? "border-amber-400/30 bg-amber-500/15 text-amber-200 shadow-inner"
              : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
        }`}
      >
        <svg
          className="w-4 h-4 md:w-[18px] md:h-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
          />
        </svg>
        <span className="hidden sm:inline">
          {room ? `一起看 (${room.memberCount})` : "一起看"}
        </span>
        {room && wsConnected && (
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        )}
      </button>

      {/* 一起看面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-3 sm:right-8 bottom-16 sm:bottom-24 w-[calc(100%-1.5rem)] sm:w-80 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 bg-black/90 backdrop-blur-xl p-3 sm:p-5 shadow-2xl z-[200]"
          >
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">
              一起看
            </h4>

            {/* 错误提示 */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-3 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-[10px] text-red-300"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {!room ? (
              /* ── 未加入房间：创建 / 输入房间号加入 ── */
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void handleCreateRoom()}
                  disabled={isCreating}
                  className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isCreating ? "创建中..." : "创建房间"}
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[9px] text-white/30 font-bold uppercase">
                    或
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="输入房间 ID"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleJoinRoom();
                      e.stopPropagation();
                    }}
                    className="flex-1 h-9 px-3 rounded-lg border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/25 focus:border-amber-400/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleJoinRoom()}
                    disabled={!joinRoomId.trim() || isJoining}
                    className="h-9 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all disabled:opacity-30"
                  >
                    {isJoining ? "..." : "加入"}
                  </button>
                </div>
              </div>
            ) : (
              /* ── 已加入房间 ── */
              <div className="space-y-3">
                {/* 房间信息 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400" : "bg-red-400"}`}
                    />
                    <span className="text-[10px] font-bold text-white/60">
                      {room.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyRoomId()}
                    title="复制房间 ID"
                    className="text-[9px] font-mono text-white/30 hover:text-white/60 transition-colors"
                  >
                    ID: {room.id.slice(0, 8)}...
                  </button>
                </div>

                {/* 成员列表 */}
                <div className="flex flex-wrap gap-1">
                  {room.members.map((m) => (
                    <span
                      key={m.userId}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                        m.userId === room.hostId
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-white/5 text-white/50 border border-white/10"
                      }`}
                    >
                      {m.userId === room.hostId && (
                        <span className="text-[8px]">👑</span>
                      )}
                      {emailToDisplayName(m.email)}
                    </span>
                  ))}
                </div>

                {/* 房主控制按钮 */}
                {isHost && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => sendSync("play")}
                      className="flex-1 h-8 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-[10px] font-bold text-green-300 border border-green-500/20 transition-all"
                    >
                      ▶ 同步播放
                    </button>
                    <button
                      type="button"
                      onClick={() => sendSync("pause")}
                      className="flex-1 h-8 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-[10px] font-bold text-yellow-300 border border-yellow-500/20 transition-all"
                    >
                      ⏸ 同步暂停
                    </button>
                    <button
                      type="button"
                      onClick={() => sendSync("seek")}
                      className="flex-1 h-8 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-[10px] font-bold text-blue-300 border border-blue-500/20 transition-all"
                    >
                      ⏩ 同步进度
                    </button>
                  </div>
                )}

                {/* 聊天区域 */}
                <div className="border-t border-white/5 pt-2">
                  <div
                    ref={chatContainerRef}
                    className="h-24 overflow-y-auto space-y-1 mb-2 scrollbar-hidden"
                  >
                    {chatMessages.length === 0 ? (
                      <div className="text-[10px] text-white/20 text-center py-6">
                        暂无消息
                      </div>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div
                          key={`${msg.timestamp}-${i}`}
                          className="text-[10px] leading-relaxed"
                        >
                          <span
                            className={`font-bold ${
                              msg.userId === currentUserId
                                ? "text-amber-400"
                                : "text-blue-300"
                            }`}
                          >
                            {emailToDisplayName(msg.email)}：
                          </span>
                          <span className="text-white/70">{msg.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="发送消息..."
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendChat();
                        e.stopPropagation();
                      }}
                      maxLength={200}
                      className="flex-1 h-7 px-2.5 rounded-lg border border-white/10 bg-white/5 text-[10px] text-white placeholder:text-white/20 focus:border-amber-400/30 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendChat}
                      disabled={!chatText.trim()}
                      className="h-7 px-3 rounded-lg bg-amber-500/20 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30 disabled:opacity-30 transition-all"
                    >
                      发送
                    </button>
                  </div>
                </div>

                {/* 离开按钮 */}
                <button
                  type="button"
                  onClick={() => void handleLeaveRoom()}
                  className="w-full h-8 rounded-xl border border-red-500/20 bg-red-500/10 text-[10px] font-bold text-red-300 hover:bg-red-500/20 transition-all"
                >
                  {isHost ? "关闭房间" : "离开房间"}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default WatchTogether;
