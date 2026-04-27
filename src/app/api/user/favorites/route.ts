import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireUser } from "@/lib/auth/require-auth";
import { UserService } from "@/services/user.service";

function getPagination(request: NextRequest) {
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
  const favorites = await UserService.getFavorites(user.userId, limit, offset);

  return NextResponse.json({ items: favorites });
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

  const result = await UserService.toggleFavorite(user.userId, seriesId);
  return NextResponse.json(result);
});
