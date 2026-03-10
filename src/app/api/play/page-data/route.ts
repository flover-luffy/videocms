import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const seriesId = parseInt(searchParams.get("seriesId") || "", 10);
    const episodeId = parseInt(searchParams.get("episodeId") || "", 10);

    if (isNaN(seriesId) || isNaN(episodeId)) {
        return NextResponse.json({ error: "无效的参数" }, { status: 400 });
    }

    const [episode, allEpisodes] = await Promise.all([
        prisma.episode.findUnique({
            where: { id: episodeId },
            include: {
                series: true,
            },
        }),
        prisma.episode.findMany({
            where: { seriesId: seriesId },
            orderBy: [{ seasonNum: "asc" }, { episodeNum: "asc" }],
            select: {
                id: true,
                episodeNum: true,
                seasonNum: true,
                title: true,
                // 显式排除 fileSize (BigInt)，因为它无法被 JSON.stringify 自动序列化
            },
        }),
    ]);

    if (!episode) {
        return NextResponse.json({ error: "集数不存在" }, { status: 404 });
    }

    // 处理 episode 对象中的 BigInt 字段 (如果有)
    const safeEpisode = JSON.parse(JSON.stringify(episode, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json({
        episode: safeEpisode,
        allEpisodes,
    });
});
