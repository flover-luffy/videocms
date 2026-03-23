import { NextRequest, NextResponse } from "next/server";
import { searchTmdbCandidates } from "@/lib/tmdb/client";
import { withApiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/auth/require-auth";

/**
 * GET /api/admin/tmdb-search?q=关键词
 * 搜索 TMDB 候选列表，供管理员手动校正时选择
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  await requireAdmin(request);

  const query = request.nextUrl.searchParams.get("q");
  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "缺少搜索关键词参数 q" },
      { status: 400 },
    );
  }

  const candidates = await searchTmdbCandidates(query.trim());

  return NextResponse.json({ candidates });
});
