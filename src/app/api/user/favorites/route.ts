import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { withApiHandler } from "@/lib/api-handler";

/**
 * 收藏 API
 * GET: 获取用户收藏的剧集列表
 * POST: 切换（Toggle）收藏状态
 */

import { UserService } from "@/services/user.service";

/**
 * 收藏 API
 * GET: 获取用户收藏的剧集列表
 * POST: 切换（Toggle）收藏状态
 */

export const GET = withApiHandler(async (request: NextRequest) => {
  const token = request.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload)
    return NextResponse.json(
      { error: "由于 Token 验证失败，请重新登录" },
      { status: 401 },
    );

  const favorites = await UserService.getFavorites(payload.userId);

  return NextResponse.json({ items: favorites });
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const token = request.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload)
    return NextResponse.json(
      { error: "由于 Token 验证失败，请重新登录" },
      { status: 401 },
    );

  const body = await request.json().catch(() => null);
  if (!body?.seriesId) {
    return NextResponse.json({ error: "Missing seriesId" }, { status: 400 });
  }

  const seriesId = parseInt(body.seriesId, 10);
  const result = await UserService.toggleFavorite(payload.userId, seriesId);

  return NextResponse.json(result);
});
