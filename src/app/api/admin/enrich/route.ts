import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchTmdbMetadata } from "@/lib/tmdb/client";
import { withApiHandler } from "@/lib/api-handler";

/**
 * 手动强制刷新/补全某部影视的 TMDB 元数据
 * POST /api/admin/enrich
 * Body: { seriesId: number }
 */
export const POST = withApiHandler(async (request: NextRequest) => {
    const body = await request.json().catch(() => null);
    const seriesIdRaw = body?.seriesId;
    if (!seriesIdRaw) {
        return NextResponse.json({ error: "Missing seriesId" }, { status: 400 });
    }

    const seriesId = parseInt(String(seriesIdRaw), 10);
    if (isNaN(seriesId)) {
        return NextResponse.json({ error: "Invalid seriesId Format" }, { status: 400 });
    }

    const series = await prisma.series.findUnique({
        where: { id: seriesId },
    });

    if (!series) {
        return NextResponse.json({ error: "找不到指定的系列" }, { status: 404 });
    }

    console.log(`[Admin Enrich] 正在手动补充元数据: ${series.title}`);

    const details = await searchTmdbMetadata(series.title);

    if (!details) {
        return NextResponse.json({ error: "在 TMDB 中未搜到匹配结果" }, { status: 404 });
    }

    // 更新数据库
    const updated = await prisma.series.update({
        where: { id: series.id },
        data: {
            tmdbId: details.tmdbId, // schema.prisma 中定义为 Int?
            type: details.type,
            overview: details.overview,
            posterUrl: details.posterUrl || series.posterUrl,
            year: details.year,
            voteAverage: details.voteAverage,
            genres: JSON.stringify(details.genres),
            director: details.director,
            cast: details.cast,
            tmdbData: details.tmdbData,
        } as any,
        select: { id: true, title: true, type: true, posterUrl: true, voteAverage: true, year: true },
    });

    return NextResponse.json({ success: true, updated });
});
