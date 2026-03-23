import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const skip = (page - 1) * limit;

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
});
