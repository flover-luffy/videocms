import logger from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

// ── 房间状态常量 ──────────────────────────────────
export const ROOM_STATUS = {
  WAITING: "waiting",
  PLAYING: "playing",
  PAUSED: "paused",
  CLOSED: "closed",
} as const;

type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];

// ── 房间信息类型 ──────────────────────────────────
export interface RoomInfo {
  id: string;
  name: string;
  status: RoomStatus;
  currentTime: number;
  hostId: number;
  seriesId: number;
  episodeId: number;
  createdAt: string;
  memberCount: number;
  members: Array<{
    userId: number;
    email: string;
    joinedAt: string;
  }>;
}

// ── 房间创建参数 ──────────────────────────────────
export interface CreateRoomInput {
  hostId: number;
  seriesId: number;
  episodeId: number;
  name?: string;
}

/** 单用户最大活跃房间数 */
const MAX_ACTIVE_ROOMS_PER_USER = 3;

/** 房间最大成员数 */
const MAX_MEMBERS_PER_ROOM = 10;

/** 房间自动过期时间（小时） */
const ROOM_EXPIRY_HOURS = 6;

// ── 服务实现 ──────────────────────────────────────
export class WatchRoomService {
  /**
   * 创建一起看房间
   */
  static async createRoom(input: CreateRoomInput): Promise<RoomInfo> {
    // 1. 检查用户活跃房间数限制
    const activeRoomCount = await prisma.watchRoom.count({
      where: {
        hostId: input.hostId,
        status: { not: ROOM_STATUS.CLOSED },
      },
    });

    if (activeRoomCount >= MAX_ACTIVE_ROOMS_PER_USER) {
      throw AppError.badRequest(
        `At most ${MAX_ACTIVE_ROOMS_PER_USER} active rooms are allowed per user`,
      );
    }

    const episode = await prisma.episode.findUnique({
      where: { id: input.episodeId },
      select: { id: true, seriesId: true },
    });
    if (!episode || episode.seriesId !== input.seriesId) {
      throw AppError.notFound("Episode does not belong to the series or does not exist");
    }

    // 3. 创建房间 + 房主自动加入
    const room = await prisma.watchRoom.create({
      data: {
        name: input.name?.trim().slice(0, 50) || "一起看",
        hostId: input.hostId,
        seriesId: input.seriesId,
        episodeId: input.episodeId,
        status: ROOM_STATUS.WAITING,
        members: {
          create: { userId: input.hostId },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    return this.formatRoomInfo(room);
  }

  /**
   * 加入房间
   */
  static async joinRoom(
    roomId: string,
    userId: number,
  ): Promise<RoomInfo> {
    return prisma.$transaction(
      async (tx) => {
        const room = await tx.watchRoom.findUnique({
          where: { id: roomId },
          include: {
            members: {
              include: {
                user: { select: { id: true, email: true } },
              },
            },
          },
        });

        if (!room) {
          throw AppError.notFound("Room not found");
        }

        if (room.status === ROOM_STATUS.CLOSED) {
          throw AppError.badRequest("Room is closed");
        }

        const alreadyJoined = room.members.some((m) => m.userId === userId);
        if (alreadyJoined) {
          return this.formatRoomInfo(room);
        }

        if (room.members.length >= MAX_MEMBERS_PER_ROOM) {
          throw AppError.badRequest("Room is full");
        }

        try {
          await tx.watchRoomMember.create({
            data: { roomId, userId },
          });
        } catch (error) {
          if ((error as { code?: string }).code !== "P2002") {
            throw error;
          }
        }

        const updatedRoom = await tx.watchRoom.findUnique({
          where: { id: roomId },
          include: {
            members: {
              include: {
                user: { select: { id: true, email: true } },
              },
            },
          },
        });

        return this.formatRoomInfo(updatedRoom!);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * 离开房间
   */
  static async leaveRoom(roomId: string, userId: number): Promise<void> {
    const room = await prisma.watchRoom.findUnique({
      where: { id: roomId },
      select: { id: true, hostId: true, status: true },
    });

    if (!room) {
      throw AppError.notFound("Room not found");
    }

    // 房主离开 = 关闭房间
    if (room.hostId === userId) {
      await prisma.watchRoom.update({
        where: { id: roomId },
        data: { status: ROOM_STATUS.CLOSED },
      });
      return;
    }

    // 普通成员离开
    await prisma.watchRoomMember.deleteMany({
      where: { roomId, userId },
    });
  }

  /**
   * 关闭房间（仅房主） */
  static async closeRoom(roomId: string, userId: number): Promise<void> {
    const room = await prisma.watchRoom.findUnique({
      where: { id: roomId },
      select: { id: true, hostId: true },
    });

    if (!room) {
      throw AppError.notFound("Room not found");
    }

    if (room.hostId !== userId) {
      throw AppError.forbidden("只有房主可以关闭房间");
    }

    await prisma.watchRoom.update({
      where: { id: roomId },
      data: { status: ROOM_STATUS.CLOSED },
    });
  }
  /**
   * 获取房间信息（仅房间成员可见） */
  static async getRoomForUser(
    roomId: string,
    userId: number,
  ): Promise<RoomInfo> {
    const room = await prisma.watchRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!room) {
      throw AppError.notFound("Room not found");
    }

    const isMember = room.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw AppError.forbidden("仅房间成员可查看房间信息");
    }

    return this.formatRoomInfo(room);
  }

  /**
   * 更新房间播放状态（房主专属） */
  static async updatePlayState(
    roomId: string,
    hostId: number,
    status: RoomStatus,
    currentTime: number,
    episodeId?: number,
  ): Promise<void> {
    const room = await prisma.watchRoom.findUnique({
      where: { id: roomId },
      select: { hostId: true },
    });

    if (!room) {
      throw AppError.notFound("Room not found");
    }
    if (room.hostId !== hostId) {
      throw AppError.forbidden("只有房主可以控制播放");
    }

    await prisma.watchRoom.update({
      where: { id: roomId },
      data: {
        status,
        currentTime,
        ...(episodeId !== undefined && { episodeId }),
      },
    });
  }

  /**
   * 清理过期房间（由 scheduler 调用） */
  static async cleanupExpiredRooms(): Promise<number> {
    const expiry = new Date(Date.now() - ROOM_EXPIRY_HOURS * 60 * 60 * 1000);

    const result = await prisma.watchRoom.updateMany({
      where: {
        status: { not: ROOM_STATUS.CLOSED },
        updatedAt: { lt: expiry },
      },
      data: { status: ROOM_STATUS.CLOSED },
    });

    if (result.count > 0) {
      logger.info(`[WatchRoom] Cleaned ${result.count} expired rooms`);
    }

    return result.count;
  }

  /**
   * 格式化房间信息输出 */
  private static formatRoomInfo(room: {
    id: string;
    name: string;
    status: string;
    currentTime: number;
    hostId: number;
    seriesId: number;
    episodeId: number;
    createdAt: Date;
    members: Array<{
      userId: number;
      joinedAt: Date;
      user: { id: number; email: string };
    }>;
  }): RoomInfo {
    return {
      id: room.id,
      name: room.name,
      status: room.status as RoomStatus,
      currentTime: room.currentTime,
      hostId: room.hostId,
      seriesId: room.seriesId,
      episodeId: room.episodeId,
      createdAt: room.createdAt.toISOString(),
      memberCount: room.members.length,
      members: room.members.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }
}


