import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireUser } from "@/lib/auth/require-auth";
import { WatchRoomService } from "@/services/watch-room.service";

/**
 * POST /api/watch-room
 * 创建一起看房间
 * Body: { seriesId, episodeId, name? }
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireUser(req);
  const body = await req.json();

  const { seriesId, episodeId, name } = body;

  if (typeof seriesId !== "number" || typeof episodeId !== "number") {
    return NextResponse.json(
      { error: "参数不完整，需要 seriesId(number) 和 episodeId(number)" },
      { status: 400 },
    );
  }

  const room = await WatchRoomService.createRoom({
    hostId: user.userId,
    seriesId,
    episodeId,
    name: typeof name === "string" ? name : undefined,
  });

  return NextResponse.json({ success: true, data: room }, { status: 201 });
});

/**
 * GET /api/watch-room
 * 获取当前用户参与的活跃房间列表
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const user = await requireUser(req);

  const { prisma } = await import("@/lib/db");

  const memberships = await prisma.watchRoomMember.findMany({
    where: { userId: user.userId },
    include: {
      room: {
        select: {
          id: true,
          name: true,
          status: true,
          hostId: true,
          seriesId: true,
          episodeId: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const activeRooms = memberships
    .filter((m) => m.room.status !== "closed")
    .map((m) => ({
      id: m.room.id,
      name: m.room.name,
      status: m.room.status,
      hostId: m.room.hostId,
      isHost: m.room.hostId === user.userId,
      seriesId: m.room.seriesId,
      episodeId: m.room.episodeId,
      memberCount: m.room._count.members,
      createdAt: m.room.createdAt.toISOString(),
    }));

  return NextResponse.json({ success: true, data: activeRooms });
});
