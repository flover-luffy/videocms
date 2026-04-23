/**
 * 一起看 WebSocket 服务器
 *
 * 技术方案：
 * - 基于 `ws` 库在 Next.js 自定义服务器中挂载
 * - 使用 URL path `/ws/watch-room` 与 HTTP 共用端口
 * - 消息协议：JSON { type, payload }
 * - 支持心跳检测，自动清理断连客户端
 */

import type { IncomingMessage } from "http";
import type { WebSocket as WsWebSocket, WebSocketServer } from "ws";
import { WS_MSG } from "./ws-protocol";

interface WsMessage {
  type: string;
  payload: Record<string, unknown>;
}

interface RoomClient {
  ws: WsWebSocket;
  userId: number;
  email: string;
  roomId: string;
  isHost: boolean;
  lastHeartbeat: number;
}

// ── 房间管理 ──────────────────────────────────────
const rooms = new Map<string, Map<number, RoomClient>>();

/** 心跳超时阈值（毫秒） */
const HEARTBEAT_TIMEOUT_MS = 30000;

/** 心跳检测间隔（毫秒） */
const HEARTBEAT_CHECK_INTERVAL_MS = 15000;

/** 获取或创建房间的客户端集合 */
function getOrCreateRoom(roomId: string): Map<number, RoomClient> {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId)!;
}

/** 向房间内所有成员广播消息（可排除指定用户） */
function broadcastToRoom(
  roomId: string,
  message: WsMessage,
  excludeUserId?: number,
) {
  const room = rooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify(message);
  for (const [userId, client] of room) {
    if (userId === excludeUserId) continue;
    if (client.ws.readyState === 1) {
      // WebSocket.OPEN
      client.ws.send(payload);
    }
  }
}

/** 向单个客户端发送消息 */
function sendToClient(client: RoomClient, message: WsMessage) {
  if (client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(message));
  }
}

/** 移除客户端并通知房间 */
function removeClient(client: RoomClient) {
  const room = rooms.get(client.roomId);
  if (room) {
    room.delete(client.userId);
    if (room.size === 0) {
      rooms.delete(client.roomId);
    } else {
      broadcastToRoom(client.roomId, {
        type: WS_MSG.MEMBER_LEAVE,
        payload: { userId: client.userId, email: client.email },
      });
    }
  }
}

// ── 消息处理 ──────────────────────────────────────

function handleJoin(
  client: RoomClient,
  payload: Record<string, unknown>,
) {
  const roomId = String(payload.roomId || "");
  const isHost = Boolean(payload.isHost);

  if (!roomId) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "缺少 roomId" },
    });
    return;
  }

  client.roomId = roomId;
  client.isHost = isHost;

  const room = getOrCreateRoom(roomId);
  room.set(client.userId, client);

  // 通知房间其他成员
  broadcastToRoom(
    roomId,
    {
      type: WS_MSG.MEMBER_JOIN,
      payload: { userId: client.userId, email: client.email },
    },
    client.userId,
  );

  // 返回当前房间成员列表
  const memberList = Array.from(room.values()).map((c) => ({
    userId: c.userId,
    email: c.email,
    isHost: c.isHost,
  }));

  sendToClient(client, {
    type: WS_MSG.ROOM_STATE,
    payload: {
      roomId,
      members: memberList,
      memberCount: memberList.length,
    },
  });
}

function handleSync(
  client: RoomClient,
  payload: Record<string, unknown>,
) {
  if (!client.isHost) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "只有房主可以同步播放状态" },
    });
    return;
  }

  // 房主同步播放状态给所有成员
  broadcastToRoom(
    client.roomId,
    {
      type: WS_MSG.PLAY_SYNC,
      payload: {
        action: payload.action, // "play" | "pause" | "seek" | "episode_change"
        currentTime: payload.currentTime,
        episodeId: payload.episodeId,
        timestamp: Date.now(),
      },
    },
    client.userId, // 不需要发回给房主自己
  );
}

function handleChat(
  client: RoomClient,
  payload: Record<string, unknown>,
) {
  const text = String(payload.text || "").trim().slice(0, 200);
  if (!text) return;

  broadcastToRoom(client.roomId, {
    type: WS_MSG.CHAT_MSG,
    payload: {
      userId: client.userId,
      email: client.email,
      text,
      timestamp: Date.now(),
    },
  });
}

function handleMessage(client: RoomClient, raw: string) {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "无效的 JSON 消息" },
    });
    return;
  }

  switch (msg.type) {
    case WS_MSG.JOIN:
      handleJoin(client, msg.payload);
      break;
    case WS_MSG.LEAVE:
      removeClient(client);
      break;
    case WS_MSG.SYNC:
      handleSync(client, msg.payload);
      break;
    case WS_MSG.CHAT:
      handleChat(client, msg.payload);
      break;
    case WS_MSG.HEARTBEAT:
      client.lastHeartbeat = Date.now();
      sendToClient(client, { type: WS_MSG.PONG, payload: {} });
      break;
    default:
      sendToClient(client, {
        type: WS_MSG.ERROR,
        payload: { message: `未知消息类型: ${msg.type}` },
      });
  }
}

// ── WebSocket 服务器初始化 ──────────────────────────

/** 从 URL 查询参数中解析用户认证信息 */
function parseAuthFromUrl(url: string): {
  userId: number;
  email: string;
} | null {
  try {
    const parsed = new URL(url, "http://localhost");
    const userId = parseInt(parsed.searchParams.get("userId") || "", 10);
    const email = parsed.searchParams.get("email") || "";

    if (!Number.isFinite(userId) || userId <= 0 || !email) {
      return null;
    }
    return { userId, email };
  } catch {
    return null;
  }
}

/**
 * 初始化 WebSocket 服务器
 * 在 Next.js 自定义服务器启动后调用
 *
 * @example
 * ```ts
 * // server.ts (自定义启动脚本)
 * import { createServer } from 'http';
 * import next from 'next';
 * import { initWatchRoomWS } from './src/lib/ws-server';
 *
 * const app = next({ dev, hostname, port });
 * const handle = app.getRequestHandler();
 * const server = createServer(handle);
 * initWatchRoomWS(server);
 * server.listen(port);
 * ```
 */
export function initWatchRoomWS(
  httpServer: import("http").Server,
): WebSocketServer | null {
  let WebSocketServerClass: typeof WebSocketServer;
  try {
    // 动态导入 ws 库，如果不存在则优雅退出
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wsModule = require("ws") as { WebSocketServer: typeof WebSocketServer };
    WebSocketServerClass = wsModule.WebSocketServer;
  } catch {
    console.warn(
      "[WS] ws 库未安装，一起看 WebSocket 功能不可用。请运行 npm install ws",
    );
    return null;
  }

  const wss = new WebSocketServerClass({
    server: httpServer,
    path: "/ws/watch-room",
  });

  console.info("[WS] ✅ 一起看 WebSocket 服务器已启动，路径: /ws/watch-room");

  wss.on("connection", (ws: WsWebSocket, req: IncomingMessage) => {
    const auth = parseAuthFromUrl(req.url || "");
    if (!auth) {
      ws.close(4001, "认证失败：缺少 userId 或 email 参数");
      return;
    }

    const client: RoomClient = {
      ws,
      userId: auth.userId,
      email: auth.email,
      roomId: "",
      isHost: false,
      lastHeartbeat: Date.now(),
    };

    ws.on("message", (data: Buffer | string) => {
      const raw = typeof data === "string" ? data : data.toString("utf-8");
      handleMessage(client, raw);
    });

    ws.on("close", () => {
      if (client.roomId) {
        removeClient(client);
      }
    });

    ws.on("error", (err: Error) => {
      console.error("[WS] 客户端连接异常:", err.message);
      if (client.roomId) {
        removeClient(client);
      }
    });
  });

  // 心跳检测定时器：清理僵尸连接
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms) {
      for (const [userId, client] of room) {
        if (now - client.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
          console.info(
            `[WS] 心跳超时，断开用户 ${userId} (房间 ${roomId})`,
          );
          client.ws.close(4002, "心跳超时");
          removeClient(client);
        }
      }
    }
  }, HEARTBEAT_CHECK_INTERVAL_MS);

  return wss;
}

/** 获取当前活跃房间统计（用于 admin 监控） */
export function getWsStats() {
  let totalClients = 0;
  for (const room of rooms.values()) {
    totalClients += room.size;
  }
  return {
    activeRooms: rooms.size,
    totalClients,
  };
}
