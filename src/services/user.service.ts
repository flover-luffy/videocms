import { prisma } from "@/lib/db";

/**
 * UserService: 处理用户相关的业务逻辑
 * 包括收藏、观看历史等
 */
export class UserService {
    /**
     * 获取用户收藏列表
     */
    static async getFavorites(userId: number) {
        return await prisma.favorite.findMany({
            where: { userId },
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
        const existing = await prisma.favorite.findUnique({
            where: {
                userId_seriesId: { userId, seriesId },
            },
        });

        if (existing) {
            await prisma.favorite.delete({
                where: {
                    userId_seriesId: { userId, seriesId },
                },
            });
            return { isFavorite: false };
        } else {
            await prisma.favorite.create({
                data: { userId, seriesId },
            });
            return { isFavorite: true };
        }
    }

    /**
     * 获取观看历史 (基于 WatchProgress)
     */
    static async getWatchHistory(userId: number) {
        return await prisma.watchProgress.findMany({
            where: { userId },
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
