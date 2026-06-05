import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import logger from "@/lib/logger";

/**
 * ProgressService: 处理播放进度相关的业务逻辑
 */
export class ProgressService {
  /**
   * 获取播放进度
   */
  static async getProgress(userId: number, episodeId: number) {
    try {
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
    } catch (error) {
      logger.error("[ProgressService] Failed to get progress:", error);
      throw new AppError(
        `获取播放进度失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
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
    try {
      const now = new Date();
      const clientTime = clientTimestamp ? new Date(clientTimestamp) : now;

      return prisma.$transaction(async (tx) => {
        const existing = await tx.watchProgress.findUnique({
          where: {
            userId_episodeId: { userId, episodeId },
          },
          select: { position: true, updatedAt: true },
        });

        if (existing && existing.updatedAt > clientTime) {
          return existing;
        }

        return tx.watchProgress.upsert({
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
      });
    } catch (error) {
      logger.error("[ProgressService] Failed to sync progress:", error);
      throw new AppError(
        `同步播放进度失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
  }
}
