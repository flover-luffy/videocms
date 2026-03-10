/**
 * 媒体列表 API
 * GET /api/series?page=1&limit=20&type=all|movie|tv&featured=true
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { normalizeJsonArray, safeJsonParse } from "@/lib/utils";

export const GET = withApiHandler(async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
    const type = searchParams.get("type");
    const featured = searchParams.get("featured");

    const where: Record<string, unknown> = {};
    if (type && type !== "all") where.type = type;
    if (featured === "true") where.isFeatured = true;

    const [total, items] = await Promise.all([
        prisma.series.count({ where }),
        prisma.series.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
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

    return NextResponse.json({
        items: items.map((s: any) => {
            const tmdb = safeJsonParse<any>(s.tmdbData, null);
            return {
                ...s,
                genres: normalizeJsonArray(s.genres),
                status: tmdb?.status || null,
                episodeCount: s._count.episodes,
                _count: undefined,
                tmdbData: undefined,
            };
        }),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    });
});
