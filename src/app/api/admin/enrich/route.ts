import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchTmdbMetadata, fetchTmdbById } from "@/lib/tmdb/client";
import { withApiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/auth/require-auth";

/**
 * 手动强制刷新/补全某部影视的 TMDB 元数据
 * POST /api/admin/enrich
 * Body: { seriesId: number, tmdbId?: number, type?: "movie" | "tv" }
 *
 * - 当提供 tmdbId + type 时：跳过搜索，直接按 ID 获取详情并绑定（手动校正模式）
 * - 仅提供 seriesId 时：按标题自动搜索（原有行为）
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  await requireAdmin(request);
  const body = await request.json().catch(() => null);
  const seriesIdRaw = body?.seriesId;
  if (!seriesIdRaw) {
    return NextResponse.json({ error: "Missing seriesId" }, { status: 400 });
  }

  const seriesId = parseInt(String(seriesIdRaw), 10);
  if (isNaN(seriesId)) {
    return NextResponse.json(
      { error: "Invalid seriesId Format" },
      { status: 400 },
    );
  }

  const series = await prisma.series.findUnique({
    where: { id: seriesId },
  });

  if (!series) {
    return NextResponse.json({ error: "找不到指定的系列" }, { status: 404 });
  }

  // 判断是手动校正模式还是自动搜索模式
  const manualTmdbId = body?.tmdbId ? parseInt(String(body.tmdbId), 10) : null;
  const manualType: "movie" | "tv" | null =
    body?.type === "movie" || body?.type === "tv" ? body.type : null;
  const isManualMatch =
    manualTmdbId !== null && !isNaN(manualTmdbId) && manualType !== null;

  let details;
  if (isManualMatch) {
    console.log(
      `[Admin Enrich] 手动校正模式: seriesId=${seriesId}, tmdbId=${manualTmdbId}, type=${manualType}`,
    );
    details = await fetchTmdbById(manualTmdbId, manualType);
  } else {
    console.log(`[Admin Enrich] 自动搜索模式: ${series.title}`);
    details = await searchTmdbMetadata(series.title);
  }

  if (!details) {
    return NextResponse.json(
      { error: "在 TMDB 中未搜到匹配结果" },
      { status: 404 },
    );
  }

  // 更新数据库
  const updated = await prisma.series.update({
    where: { id: series.id },
    data: {
      tmdbId: details.tmdbId,
      title: isManualMatch ? (details.title as string) : series.title,
      type: details.type,
      overview: details.overview,
      posterUrl: details.posterUrl || series.posterUrl,
      backdropUrl: details.backdropUrl || series.backdropUrl,
      year: details.year,
      voteAverage: details.voteAverage,
      genres: details.genres,
      director: details.director,
      cast: details.cast,
      tmdbData: details.tmdbData,
      manualMatched: isManualMatch,
    } as Record<string, unknown>,
    select: {
      id: true,
      title: true,
      type: true,
      posterUrl: true,
      voteAverage: true,
      year: true,
    },
  });

  return NextResponse.json({
    success: true,
    updated,
    manualMatched: isManualMatch,
  });
});
