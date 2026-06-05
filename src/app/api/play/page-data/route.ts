import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { verifyToken } from "@/lib/auth/jwt";
import { logger } from "@/lib/logger";

/**
 * 检查用户是否有权访问特定系列
 */
async function userHasAccessToSeries(
  userId: number,
  _seriesId: number,
): Promise<boolean> {
  // 根据当前产品的运营策略，所有通过 JWT 身份验证的注册用户（包含普通用户与管理员）
  // 均可访问通用媒体库。如后续衍生收费模块，此处应挂载外部权限插件。
  return !!userId;
}

export const GET = withApiHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const seriesId = parseInt(searchParams.get("seriesId") || "", 10);
  const episodeId = parseInt(searchParams.get("episodeId") || "", 10);

  if (isNaN(seriesId) || isNaN(episodeId)) {
    return NextResponse.json({ error: "无效的参数" }, { status: 400 });
  }

  // 验证用户权限
  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: "需要登录才能观看内容" },
      { status: 401 },
    );
  }

  try {
    const payload = await verifyToken(accessToken);

    if (!payload || typeof payload === "string") {
      return NextResponse.json({ error: "无效的认证信息" }, { status: 401 });
    }

    // 检查用户是否有权限访问此系列
    const hasAccess = await userHasAccessToSeries(payload.userId, seriesId);
    if (!hasAccess) {
      return NextResponse.json({ error: "您无权访问此内容" }, { status: 403 });
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
    const safeEpisode = JSON.parse(
      JSON.stringify(episode, (key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );

    return NextResponse.json({
      episode: safeEpisode,
      allEpisodes,
    });
  } catch (error) {
    logger.error("获取播放页面数据失败", error);
    return NextResponse.json({ error: "获取播放页面数据失败" }, { status: 500 });
  }
});
