/**
 * 涓€璧风湅 WebSocket 鏈嶅姟鍣? *
 * 鎶€鏈柟妗堬細
 * - 鍩轰簬 `ws` 搴撳湪 Next.js 鑷畾涔夋湇鍔″櫒涓寕杞? * - 浣跨敤 URL path `/ws/watch-room` 涓?HTTP 鍏辩敤绔彛
 * - 娑堟伅鍗忚锛欽SON { type, payload }
 * - 鏀寔蹇冭烦妫€娴嬶紝鑷姩娓呯悊鏂繛瀹㈡埛绔? */

import type { IncomingMessage } from "http";
import type { WebSocket as WsWebSocket, WebSocketServer } from "ws";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";
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

// 鈹€鈹€ 鎴块棿绠＄悊 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const rooms = new Map<string, Map<number, RoomClient>>();

/** 蹇冭烦瓒呮椂闃堝€硷紙姣锛?*/
const HEARTBEAT_TIMEOUT_MS = 30000;

/** 蹇冭烦妫€娴嬮棿闅旓紙姣锛?*/
const HEARTBEAT_CHECK_INTERVAL_MS = 15000;

/** 鑾峰彇鎴栧垱寤烘埧闂寸殑瀹㈡埛绔泦鍚?*/
function getOrCreateRoom(roomId: string): Map<number, RoomClient> {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId)!;
}

/** 鍚戞埧闂村唴鎵€鏈夋垚鍛樺箍鎾秷鎭紙鍙帓闄ゆ寚瀹氱敤鎴凤級 */
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

/** 鍚戝崟涓鎴风鍙戦€佹秷鎭?*/
function sendToClient(client: RoomClient, message: WsMessage) {
  if (client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(message));
  }
}

/** 绉婚櫎瀹㈡埛绔苟閫氱煡鎴块棿 */
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

// 鈹€鈹€ 娑堟伅澶勭悊 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

async function handleJoin(
  client: RoomClient,
  payload: Record<string, unknown>,
): Promise<void> {
  const roomId = String(payload.roomId || "");

  if (!roomId) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "缂哄皯 roomId" },
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
      payload: { message: "璇峰厛閫氳繃 API 鍔犲叆鎴块棿" },
    });
    return;
  }

  client.roomId = roomId;
  client.isHost = dbRoom.hostId === client.userId;

  const room = getOrCreateRoom(roomId);
  room.set(client.userId, client);

  // 閫氱煡鎴块棿鍏朵粬鎴愬憳
  broadcastToRoom(
    roomId,
    {
      type: WS_MSG.MEMBER_JOIN,
      payload: { userId: client.userId, email: client.email },
    },
    client.userId,
  );

  // 杩斿洖褰撳墠鎴块棿鎴愬憳鍒楄〃
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
      payload: { message: "璇峰厛鍔犲叆鎴块棿" },
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
    client.userId, // 涓嶉渶瑕佸彂鍥炵粰鎴夸富鑷繁
  );
}

function handleChat(
  client: RoomClient,
  payload: Record<string, unknown>,
) {
  if (!client.roomId) {
    sendToClient(client, {
      type: WS_MSG.ERROR,
      payload: { message: "璇峰厛鍔犲叆鎴块棿" },
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
      payload: { message: "鏃犳晥鐨?JSON 娑堟伅" },
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
        payload: { message: `鏈煡娑堟伅绫诲瀷: ${msg.type}` },
      });
  }
}

// 鈹€鈹€ WebSocket 鏈嶅姟鍣ㄥ垵濮嬪寲 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

/** 浠庢彙鎵?Cookie 涓В鏋愬苟楠岃瘉鐪熷疄鐢ㄦ埛韬唤 */
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
 * 鍒濆鍖?WebSocket 鏈嶅姟鍣? * 鍦?Next.js 鑷畾涔夋湇鍔″櫒鍚姩鍚庤皟鐢? *
 * @example
 * ```ts
 * // server.ts (鑷畾涔夊惎鍔ㄨ剼鏈?
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
      "[WS] ws 搴撴湭瀹夎锛屼竴璧风湅 WebSocket 鍔熻兘涓嶅彲鐢ㄣ€傝杩愯 npm install ws",
    );
    return null;
  }

  const wss = new WebSocketServerClass({
    server: httpServer,
    path: "/ws/watch-room",
    maxPayload: 1024 * 1024,
  });

  console.info("[WS] 鉁?涓€璧风湅 WebSocket 鏈嶅姟鍣ㄥ凡鍚姩锛岃矾寰? /ws/watch-room");

  wss.on("connection", async (ws: WsWebSocket, req: IncomingMessage) => {
    const auth = await parseAuthFromRequest(req);
    if (!auth) {
      ws.close(4001, "璁よ瘉澶辫触锛歍oken 鏃犳晥鎴栧凡杩囨湡");
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
        console.error("[WS] 娑堟伅澶勭悊澶辫触", err);
        sendToClient(client, {
          type: WS_MSG.ERROR,
          payload: { message: "娑堟伅澶勭悊澶辫触" },
        });
      });
    });

    ws.on("close", () => {
      if (client.roomId) {
        removeClient(client);
      }
    });

    ws.on("error", (err: Error) => {
      console.error("[WS] 瀹㈡埛绔繛鎺ュ紓甯?", err.message);
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
            `[WS] 蹇冭烦瓒呮椂锛屾柇寮€鐢ㄦ埛 ${userId} (鎴块棿 ${roomId})`,
          );
          client.ws.close(4002, "蹇冭烦瓒呮椂");
          removeClient(client);
        }
      }
    }
  }, HEARTBEAT_CHECK_INTERVAL_MS);

  return wss;
}

