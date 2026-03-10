import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { withApiHandler } from "@/lib/api-handler";

/**
 * 播放历史聚合 API
 * 返回当前用户的所有观影记录，按更新时间倒序排列
 */
import { UserService } from "@/services/user.service";

/**
 * 播放历史聚合 API
 * 返回当前用户的所有观影记录，按更新时间倒序排列
 */
export const GET = withApiHandler(async (request: NextRequest) => {
    const token = request.cookies.get("access_token")?.value;
    if (!token) return NextResponse.json({ history: [] });

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) return NextResponse.json({ history: [] });

    // 查询所有观看记录并关联集数和剧集信息
    const history = await UserService.getWatchHistory(payload.userId);

    return NextResponse.json({
        history: history.map((item) => ({
            id: item.id,
            episodeId: item.episodeId,
            position: item.position,
            duration: item.duration,
            updatedAt: item.updatedAt,
            episode: {
                episodeNum: item.episode.episodeNum,
                seasonNum: item.episode.seasonNum,
                title: item.episode.title,
                seriesId: item.episode.series.id,
                seriesTitle: item.episode.series.title,
                posterUrl: item.episode.series.posterUrl,
            },
        })),
    });
});

export const DELETE = withApiHandler(async (request: NextRequest) => {
    const token = request.cookies.get("access_token")?.value;
    if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) return NextResponse.json({ error: "由于 Token 验证失败，请重新登录" }, { status: 401 });

    await UserService.clearWatchHistory(payload.userId);

    return NextResponse.json({ success: true });
});
