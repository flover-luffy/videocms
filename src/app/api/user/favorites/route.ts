import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireUser } from "@/lib/auth/require-auth";
import { UserService } from "@/services/user.service";
import { logger } from "@/lib/logger";

function getPagination(request: NextRequest): { limit: number; offset: number } {
  const limit = Number.parseInt(
    request.nextUrl.searchParams.get("limit") || "50",
    10,
  );
  const page = Number.parseInt(
    request.nextUrl.searchParams.get("page") || "1",
    10,
  );

  const safeLimit = Number.isFinite(limit) ? limit : 50;
  const safePage = Number.isFinite(page) ? page : 1;

  return {
    limit: safeLimit,
    offset: Math.max(safePage - 1, 0) * safeLimit,
  };
}

export const GET = withApiHandler(async (request: NextRequest) => {
  const user = await requireUser(request);
  const { limit, offset } = getPagination(request);

  try {
    const favorites = await UserService.getFavorites(user.userId, limit, offset);
    return NextResponse.json({ items: favorites });
  } catch (error) {
    logger.error("获取收藏列表失败", error);
    return NextResponse.json({ error: "获取收藏列表失败" }, { status: 500 });
  }
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const user = await requireUser(request);
  const body = await request.json().catch(() => null);

  if (!body?.seriesId) {
    return NextResponse.json({ error: "Missing seriesId" }, { status: 400 });
  }

  const seriesId = Number.parseInt(String(body.seriesId), 10);
  if (!Number.isFinite(seriesId) || seriesId <= 0) {
    return NextResponse.json({ error: "Invalid seriesId" }, { status: 400 });
  }

  try {
    const result = await UserService.toggleFavorite(user.userId, seriesId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("切换收藏状态失败", error);
    return NextResponse.json({ error: "切换收藏状态失败" }, { status: 500 });
  }
});
