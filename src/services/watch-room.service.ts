import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

// 鈹€鈹€ 鎴块棿鐘舵€佸父閲?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
export const ROOM_STATUS = {
  WAITING: "waiting",
  PLAYING: "playing",
  PAUSED: "paused",
  CLOSED: "closed",
} as const;

type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];

// 鈹€鈹€ 鎴块棿淇℃伅绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ 鎴块棿鍒涘缓鍙傛暟 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
export interface CreateRoomInput {
  hostId: number;
  seriesId: number;
  episodeId: number;
  name?: string;
}

/** 鍗曠敤鎴锋渶澶ф椿璺冩埧闂存暟 */
const MAX_ACTIVE_ROOMS_PER_USER = 3;

/** 鎴块棿鏈€澶ф垚鍛樻暟 */
const MAX_MEMBERS_PER_ROOM = 10;

/** 鎴块棿鑷姩杩囨湡鏃堕棿锛堝皬鏃讹級 */
const ROOM_EXPIRY_HOURS = 6;

// 鈹€鈹€ 鏈嶅姟瀹炵幇 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
export class WatchRoomService {
  /**
   * 鍒涘缓涓€璧风湅鎴块棿
   */
  static async createRoom(input: CreateRoomInput): Promise<RoomInfo> {
    // 1. 妫€鏌ョ敤鎴锋椿璺冩埧闂存暟闄愬埗
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

    // 3. 鍒涘缓鎴块棿 + 鎴夸富鑷姩鍔犲叆
    const room = await prisma.watchRoom.create({
      data: {
        name: input.name?.trim().slice(0, 50) || "涓€璧风湅",
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
   * 鍔犲叆鎴块棿
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
   * 绂诲紑鎴块棿
   */
  static async leaveRoom(roomId: string, userId: number): Promise<void> {
    const room = await prisma.watchRoom.findUnique({
      where: { id: roomId },
      select: { id: true, hostId: true, status: true },
    });

    if (!room) {
      throw AppError.notFound("Room not found");
    }

    // 鎴夸富绂诲紑 = 鍏抽棴鎴块棿
    if (room.hostId === userId) {
      await prisma.watchRoom.update({
        where: { id: roomId },
        data: { status: ROOM_STATUS.CLOSED },
      });
      return;
    }

    // 鏅€氭垚鍛樼寮€
    await prisma.watchRoomMember.deleteMany({
      where: { roomId, userId },
    });
  }

  /**
   * 鍏抽棴鎴块棿锛堜粎鎴夸富锛?   */
  static async closeRoom(roomId: string, userId: number): Promise<void> {
    const room = await prisma.watchRoom.findUnique({
      where: { id: roomId },
      select: { id: true, hostId: true },
    });

    if (!room) {
      throw AppError.notFound("Room not found");
    }

    if (room.hostId !== userId) {
      throw AppError.forbidden("鍙湁鎴夸富鍙互鍏抽棴鎴块棿");
    }

    await prisma.watchRoom.update({
      where: { id: roomId },
      data: { status: ROOM_STATUS.CLOSED },
    });
  }
  /**
   * 鑾峰彇鎴块棿淇℃伅锛堜粎鎴块棿鎴愬憳鍙锛?   */
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
      throw AppError.forbidden("浠呮埧闂存垚鍛樺彲鏌ョ湅鎴块棿淇℃伅");
    }

    return this.formatRoomInfo(room);
  }

  /**
   * 鏇存柊鎴块棿鎾斁鐘舵€侊紙鎴夸富涓撳睘锛?   */
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
      throw AppError.forbidden("鍙湁鎴夸富鍙互鎺у埗鎾斁");
    }

    const updateData: Record<string, unknown> = { status, currentTime };
    if (episodeId !== undefined) {
      updateData.episodeId = episodeId;
    }

    await prisma.watchRoom.update({
      where: { id: roomId },
      data: updateData,
    });
  }

  /**
   * 娓呯悊杩囨湡鎴块棿锛堢敱 scheduler 璋冪敤锛?   */
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
      console.info(`[WatchRoom] Cleaned ${result.count} expired rooms`);
    }

    return result.count;
  }

  /**
   * 鏍煎紡鍖栨埧闂翠俊鎭緭鍑?   */
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

