import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { normalizeJsonArray, safeJsonParse } from "@/lib/utils";

/**
 * 影视剧集业务逻辑层
 */
export class SeriesService {
    /**
     * 按条件获取剧集列表（带关联统计）
     */
    static async getSeriesList(options: {
        type?: "featured" | "popular" | "recent" | "toprated";
        limit?: number;
        offset?: number;
    }) {
        const { type, limit = 10, offset = 0 } = options;
        const where: Prisma.SeriesWhereInput = {};
        let orderBy: Prisma.SeriesOrderByWithRelationInput[] = [{ createdAt: "desc" }];

        if (type === "featured") {
            where.isFeatured = true;
        } else if (type === "popular") {
            orderBy = [{ playCount: "desc" }, { createdAt: "desc" }];
        } else if (type === "toprated") {
            orderBy = [{ voteAverage: "desc" }, { createdAt: "desc" }];
        }

        const [total, items] = await Promise.all([
            prisma.series.count({ where }),
            prisma.series.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy,
                select: {
                    id: true,
                    title: true,
                    type: true,
                    posterUrl: true,
                    backdropUrl: true,
                    voteAverage: true,
                    year: true,
                    genres: true,
                    tmdbData: true,
                    isFeatured: true,
                    playCount: true,
                    createdAt: true,
                    _count: { select: { episodes: true } },
                },
            }),
        ]);

        return {
            items: items.map((s) => {
                const tmdb = safeJsonParse<any>(s.tmdbData, null);
                return {
                    ...s,
                    genres: normalizeJsonArray(s.genres),
                    status: tmdb?.status || null,
                    episodeCount: s._count.episodes,
                    _count: undefined,
                    tmdbData: undefined, // 不在列表接口中返回完整 JSON
                };
            }),
            total,
            hasMore: offset + limit < total,
        };
    }

    /**
     * 获取单部剧集详情（支持集数分页）
     * @param id      Series ID
     * @param page    集数页码，默认第 1 页
     * @param pageSize 每页数量，默认 200（兼容旧行为）
     */
    static async getSeriesById(id: number, page = 1, pageSize = 200) {
        const skip = (page - 1) * pageSize;
        return prisma.series.findUnique({
            where: { id },
            include: {
                episodes: {
                    orderBy: [{ seasonNum: "asc" }, { episodeNum: "asc" }],
                    skip,
                    take: pageSize,
                },
                openlistConfig: true,
            },
        });
    }

    /**
     * 删除剧集（级联删除由数据库层 handle）
     */
    static async deleteSeries(id: number) {
        return prisma.series.delete({
            where: { id },
        });
    }
}
