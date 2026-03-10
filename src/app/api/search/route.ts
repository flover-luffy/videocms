import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { SearchSchema } from "@/lib/validation";
import { createRateLimiter, RATE_LIMITS } from "@/lib/rate-limit";
import { API_TIMEOUT_CONFIG } from "@/config";
import { searchCache } from "@/lib/cache";

const rateLimiter = createRateLimiter(RATE_LIMITS.search);

/**
 * 全局搜索接口
 * GET /api/search?q=xxx&type=all&page=1&limit=20
 */
export const GET = withApiHandler(async (request: NextRequest) => {
    // 应用速率限制
    const rateLimitResponse = rateLimiter(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const type = searchParams.get("type") ?? "all";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

    // 验证输入
    const result = SearchSchema.safeParse({ q: query, type });
    if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { q } = result.data;

    // 生成缓存键
    const cacheKey = `search:${q}:${type}:${page}:${limit}`;

    // 尝试从缓存获取
    const cached = searchCache.get(cacheKey);
    if (cached) {
        return NextResponse.json(cached);
    }

    // 使用原生 SQL 进行多字段模糊检索 (SQLite)
    try {
        const likeQuery = `%${q}%`;

        // 获取匹配的记录及其总数
        // 检索字段包括：标题 (title)、导演 (director) 以及 JSON 格式的演职员表 (cast)
        const matchedItems = await prisma.$queryRawUnsafe<{ id: number }[]>(
            `SELECT id FROM Series 
             WHERE title LIKE ? 
                OR director LIKE ? 
                OR CAST("cast" AS TEXT) LIKE ?
             ORDER BY playCount DESC, createdAt DESC
             LIMIT ? OFFSET ?`,
            likeQuery,
            likeQuery,
            likeQuery,
            limit,
            (page - 1) * limit
        );

        if (matchedItems.length === 0) {
            return NextResponse.json({
                items: [],
                total: 0,
                page,
                limit,
                totalPages: 0
            });
        }

        const ids = matchedItems.map(row => row.id);

        // 获取完整模型数据
        const items = await prisma.series.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                title: true,
                type: true,
                posterUrl: true,
                year: true,
                voteAverage: true,
                _count: { select: { episodes: true } },
            },
            // 保持原始 SQL 查询的排序
            orderBy: [
                { playCount: "desc" },
                { createdAt: "desc" },
            ],
        });

        // 获取符合条件的总数
        const totalResult = await prisma.$queryRawUnsafe<{ count: number }[]>(
            `SELECT COUNT(*) as count FROM Series 
             WHERE title LIKE ? 
                OR director LIKE ? 
                OR CAST("cast" AS TEXT) LIKE ?`,
            likeQuery,
            likeQuery,
            likeQuery
        );
        const total = Number(totalResult[0]?.count ?? 0);

        const formatted = items.map((s) => ({
            ...s,
            episodeCount: s._count.episodes,
            _count: undefined,
        }));

        const response = {
            items: formatted,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };

        // 缓存结果
        searchCache.set(cacheKey, response);

        return NextResponse.json(response);
    } catch (err) {
        console.error("[Search] 搜索执行失败:", err);
        return NextResponse.json({ error: "搜索服务暂时不可用" }, { status: 500 });
    }
}, { timeout: API_TIMEOUT_CONFIG.SEARCH });
