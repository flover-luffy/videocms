/**
 * 一起看 WebSocket 消息协议常量
 *
 * 同时被 ws-server.ts (服务端) 和 WatchTogether.tsx (客户端) 引用
 */
export const WS_MSG = {
  // 客户端 → 服务器
  JOIN: "join",
  LEAVE: "leave",
  SYNC: "sync",
  CHAT: "chat",
  HEARTBEAT: "heartbeat",

  // 服务器 → 客户端
  ROOM_STATE: "room_state",
  MEMBER_JOIN: "member_join",
  MEMBER_LEAVE: "member_leave",
  PLAY_SYNC: "play_sync",
  CHAT_MSG: "chat_msg",
  ERROR: "error",
  PONG: "pong",
} as const;

export type WsMessageType = (typeof WS_MSG)[keyof typeof WS_MSG];
