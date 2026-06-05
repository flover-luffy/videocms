import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const GET = withApiHandler(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const parsedLimit = parseInt(searchParams.get("limit") || "20", 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 100);
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1);
  const skip = (page - 1) * limit;

  try {
    const [albums, total] = await Promise.all([
      prisma.album.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          artist: true,
          coverUrl: true,
          year: true,
          _count: {
            select: { tracks: true },
          },
        },
      }),
      prisma.album.count(),
    ]);

    return NextResponse.json({
      items: albums,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + albums.length < total,
    });
  } catch (error) {
    logger.error("查询专辑列表失败", error);
    return NextResponse.json({ error: "查询专辑列表失败" }, { status: 500 });
  }
});
