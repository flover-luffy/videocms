import { prisma } from "@/lib/db";

/**
 * ProgressService: 处理播放进度相关的业务逻辑
 */
export class ProgressService {
  /**
   * 获取播放进度
   */
  static async getProgress(userId: number, episodeId: number) {
    const progress = await prisma.watchProgress.findUnique({
      where: {
        userId_episodeId: { userId, episodeId },
      },
      select: { position: true, duration: true, updatedAt: true },
    });

    return {
      position: progress?.position || 0,
      duration: progress?.duration || 0,
      updatedAt: progress?.updatedAt?.getTime() || 0,
    };
  }

  /**
   * 同步/更新播放进度（带时间戳冲突解决）
   */
  static async syncProgress(
    userId: number,
    episodeId: number,
    position: number,
    duration?: number,
    clientTimestamp?: number,
  ) {
    const now = new Date();
    const clientTime = clientTimestamp ? new Date(clientTimestamp) : now;

    // 获取现有记录
    const existing = await prisma.watchProgress.findUnique({
      where: {
        userId_episodeId: { userId, episodeId },
      },
      select: { position: true, updatedAt: true },
    });

    // 如果服务器上的记录更新，则保留较新的位置
    if (existing && existing.updatedAt > clientTime) {
      return existing;
    }

    return await prisma.watchProgress.upsert({
      where: {
        userId_episodeId: { userId, episodeId },
      },
      create: {
        userId,
        episodeId,
        position: Math.floor(position),
        duration: duration ? Math.floor(duration) : null,
        updatedAt: clientTime,
      },
      update: {
        position: Math.floor(position),
        duration: duration ? Math.floor(duration) : undefined,
        updatedAt: clientTime,
      },
    });
  }
}
