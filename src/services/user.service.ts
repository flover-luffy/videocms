import { prisma } from "@/lib/db";

function clampLimit(limit = 50): number {
  return Math.min(Math.max(Math.floor(limit), 1), 100);
}

function clampOffset(offset = 0): number {
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
  }

  /**
   * 切换收藏状态
   */
  static async toggleFavorite(userId: number, seriesId: number) {
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
  }

  /**
   * 获取观看历史 (基于 WatchProgress)
   */
  static async getWatchHistory(userId: number, limit = 50, offset = 0) {
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
  }

  /**
   * 清除观看历史
   */
  static async clearWatchHistory(userId: number) {
    return await prisma.watchProgress.deleteMany({
      where: { userId },
    });
  }
}
