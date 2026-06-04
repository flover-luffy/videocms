/**
 * 一起看 WebSocket 服务端
 * 技术方案：
 * - 基于 `ws` 库在 Next.js 自定义服务端中挂载
 * - 使用 URL path `/ws/watch-room` 与 HTTP 共用端口
 * - 消息协议：JSON { type, payload }
 * - 支持心跳检测，自动清理断连客户端
 */

import type { IncomingMessage } from "http";
import type { WebSocket as WsWebSocket, WebSocketServer } from "ws";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";
import { WatchRoomService } from "@/services/watch-room.service";
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

async function handleJoin(
  client: RoomClient,
  payload: Record<string, unknown>,
): Promise<void> {
  const roomId = String(payload.roomId || "");

  if (!roomId) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "缺少 roomId" },
    });
    return;
  }

  const dbRoom = await prisma.watchRoom.findUnique({
    where: { id: roomId },
    select: {
      hostId: true,
      status: true,
      members: {
        where: { userId: client.userId },
        select: { userId: true },
      },
    },
  });

  if (!dbRoom) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "Room not found" },
    });
    return;
  }

  if (dbRoom.status === "closed") {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "Room is closed" },
    });
    return;
  }

  if (dbRoom.members.length === 0) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "请先通过 API 加入房间" },
    });
    return;
  }

  client.roomId = roomId;
  client.isHost = dbRoom.hostId === client.userId;

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
  if (!client.roomId) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "请先加入房间" },
    });
    return;
  }

  if (!client.isHost) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "Only the host can sync playback state" },
    });
    return;
  }

  const action = String(payload.action || "");
  const currentTime = Number(payload.currentTime);
  const episodeId = Number(payload.episodeId);
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
  const safeEpisodeId = Number.isFinite(episodeId) && episodeId > 0 ? episodeId : undefined;
  const nextStatus = action === "pause" ? "paused" : "playing";

  void WatchRoomService.updatePlayState(
    client.roomId,
    client.userId,
    nextStatus,
    safeCurrentTime,
    safeEpisodeId,
  ).catch((err) => {
    console.error("[WS] 同步播放状态失败", err);
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "同步播放状态失败" },
    });
  });

  broadcastToRoom(
    client.roomId,
    {
      type: WS_MSG.PLAY_SYNC,
      payload: {
        action,
        currentTime: safeCurrentTime,
        episodeId: safeEpisodeId,
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
  if (!client.roomId) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "请先加入房间" },
    });
    return;
  }

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

async function handleMessage(client: RoomClient, raw: string): Promise<void> {
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
      await handleJoin(client, msg.payload);
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

// ── WebSocket 服务端初始化 ────────────────────────

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) return acc;

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key) {
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
    }
    return acc;
  }, {});
}

/** 从握手 Cookie 中解析并验证真实用户身份 */
async function parseAuthFromRequest(req: IncomingMessage): Promise<{
  userId: number;
  email: string;
} | null> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.access_token;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.userId || !payload.email) return null;

  return {
    userId: payload.userId,
    email: payload.email,
  };
}

/**
 * 初始化 WebSocket 服务端（在 Next.js 自定义服务端启动后调用）
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
    // Dynamically load ws so the app can still run when ws is not installed.
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
    maxPayload: 1024 * 1024,
  });

  console.info("[WS] 一起看 WebSocket 服务端已启动，路径: /ws/watch-room");

  wss.on("connection", async (ws: WsWebSocket, req: IncomingMessage) => {
    // SECURITY: Validate Origin header to prevent CSWSH attacks
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001'];

    if (origin && !allowedOrigins.includes(origin)) {
      ws.close(1008, "Invalid origin");
      return;
    }

    const auth = await parseAuthFromRequest(req);
    if (!auth) {
      ws.close(4001, "认证失败：Token 无效或已过期");
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
      void handleMessage(client, raw).catch((err) => {
        console.error("[WS] 消息处理失败", err);
        sendToClient(client, {
          type: WS_MSG.ERROR,
          payload: { message: "消息处理失败" },
        });
      });
    });

    ws.on("close", () => {
      if (client.roomId) {
        removeClient(client);
      }
    });

    ws.on("error", (err: Error) => {
      console.error("[WS] 客户端连接异常", err.message);
      if (client.roomId) {
        removeClient(client);
      }
    });
  });

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

