import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireUser } from "@/lib/auth/require-auth";
import { WatchRoomService } from "@/services/watch-room.service";

type RouteContext = { params: Promise<{ roomId: string }> };

/**
 * GET /api/watch-room/[roomId]
 * 获取房间详情
 */
export const GET = withApiHandler(async (req: NextRequest, ctx: RouteContext) => {
  const user = await requireUser(req);
  const { roomId } = await ctx.params;

  const room = await WatchRoomService.getRoomForUser(roomId, user.userId);
  return NextResponse.json({ success: true, data: room });
});

/**
 * POST /api/watch-room/[roomId]
 * 加入或操作房间
 * Body: { action: "join" | "leave" | "close" }
 */
export const POST = withApiHandler(async (req: NextRequest, ctx: RouteContext) => {
  const user = await requireUser(req);
  const { roomId } = await ctx.params;
  const body = await req.json();
  const action = body.action;

  switch (action) {
    case "join": {
      const room = await WatchRoomService.joinRoom(roomId, user.userId);
      return NextResponse.json({ success: true, data: room });
    }
    case "leave": {
      await WatchRoomService.leaveRoom(roomId, user.userId);
      return NextResponse.json({ success: true, message: "已离开房间" });
    }
    case "close": {
      // SECURITY: API层授权检查 - 验证房间所有权
      const room = await WatchRoomService.getRoomForUser(roomId, user.userId);
      if (room.hostId !== user.userId) {
        return NextResponse.json(
          { error: "只有房主可以关闭房间" },
          { status: 403 }
        );
      }
      await WatchRoomService.closeRoom(roomId, user.userId);
      return NextResponse.json({ success: true, message: "房间已关闭" });
    }
    default:
      return NextResponse.json(
        { error: "未知操作，支持: join, leave, close" },
        { status: 400 },
      );
  }
});

/**
 * DELETE /api/watch-room/[roomId]
 * 关闭房间（房主专用）
 */
export const DELETE = withApiHandler(async (req: NextRequest, ctx: RouteContext) => {
  const user = await requireUser(req);
  const { roomId } = await ctx.params;

  // SECURITY: API层授权检查 - 验证房间所有权
  const room = await WatchRoomService.getRoomForUser(roomId, user.userId);
  if (room.hostId !== user.userId) {
    return NextResponse.json(
      { error: "只有房主可以关闭房间" },
      { status: 403 }
    );
  }

  await WatchRoomService.closeRoom(roomId, user.userId);
  return NextResponse.json({ success: true, message: "房间已关闭" });
});
