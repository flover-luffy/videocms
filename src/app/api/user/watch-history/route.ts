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
  const history = await UserService.getWatchHistory(user.userId, limit, offset);

  return NextResponse.json({
    history: history.map((item) => ({
      id: item.id,
      episodeId: item.episodeId,
      position: item.position,
      duration: item.duration,
      updatedAt: item.updatedAt,
      episode: {
        id: item.episode.id,
        episodeNum: item.episode.episodeNum,
        seasonNum: item.episode.seasonNum,
        title: item.episode.title,
        series: {
          id: item.episode.series.id,
          title: item.episode.series.title,
          posterUrl: item.episode.series.posterUrl,
          backdropUrl: item.episode.series.backdropUrl,
        },
      },
    })),
  });
});

export const DELETE = withApiHandler(async (request: NextRequest) => {
  const user = await requireUser(request);
  await UserService.clearWatchHistory(user.userId);
  return NextResponse.json({ success: true });
});
