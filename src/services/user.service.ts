import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import logger from "@/lib/logger";

function clampLimit(limit: number = 50): number {
  return Math.min(Math.max(Math.floor(limit), 1), 100);
}

function clampOffset(offset: number = 0): number {
  return Math.max(Math.floor(offset), 0);
}

/**
 * UserService: 处理用户相关的业务逻辑
 * 包括收藏、观看历史等
 */
export class UserService {
  /**
   * 获取用户收藏列表
   */
  static async getFavorites(userId: number, limit = 50, offset = 0) {
    try {
      return await prisma.favorite.findMany({
        where: { userId },
        take: clampLimit(limit),
        skip: clampOffset(offset),
        include: {
          series: {
            select: {
              id: true,
              title: true,
              type: true,
              posterUrl: true,
              voteAverage: true,
              year: true,
              _count: { select: { episodes: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.error("[UserService] Failed to get favorites:", error);
      throw new AppError(
        `获取收藏列表失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
  }

  /**
   * 切换收藏状态
   */
  static async toggleFavorite(userId: number, seriesId: number) {
    try {
      const deleted = await prisma.favorite.deleteMany({
        where: { userId, seriesId },
      });

      if (deleted.count > 0) {
        return { isFavorite: false };
      }

      try {
        await prisma.favorite.create({
          data: { userId, seriesId },
        });
        return { isFavorite: true };
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
          await prisma.favorite.deleteMany({ where: { userId, seriesId } });
          return { isFavorite: false };
        }
        throw error;
      }
    } catch (error) {
      logger.error("[UserService] Failed to toggle favorite:", error);
      throw new AppError(
        `切换收藏状态失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
  }

  /**
   * 获取观看历史 (基于 WatchProgress)
   */
  static async getWatchHistory(userId: number, limit = 50, offset = 0) {
    try {
      return await prisma.watchProgress.findMany({
        where: { userId },
        take: clampLimit(limit),
        skip: clampOffset(offset),
        orderBy: { updatedAt: "desc" },
        include: {
          episode: {
            select: {
              id: true,
              episodeNum: true,
              seasonNum: true,
              title: true,
              series: {
                select: {
                  id: true,
                  title: true,
                  posterUrl: true,
                  backdropUrl: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      logger.error("[UserService] Failed to get watch history:", error);
      throw new AppError(
        `获取观看历史失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
  }

  /**
   * 清除观看历史
   */
  static async clearWatchHistory(userId: number) {
    try {
      return await prisma.watchProgress.deleteMany({
        where: { userId },
      });
    } catch (error) {
      logger.error("[UserService] Failed to clear watch history:", error);
      throw new AppError(
        `清除观看历史失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
  }
}
