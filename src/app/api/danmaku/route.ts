import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { DanmakuService } from "@/services/danmaku.service";
import { requireUser } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/danmaku?episodeId=xxx
 * 获取指定集数的全部弹幕（公开接口，无需登录）
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const episodeIdStr = url.searchParams.get("episodeId");

  if (!episodeIdStr) {
    return NextResponse.json(
      { error: "缺少 episodeId 参数" },
      { status: 400 },
    );
  }

  const episodeId = parseInt(episodeIdStr, 10);
  if (!Number.isFinite(episodeId) || episodeId <= 0) {
    return NextResponse.json(
      { error: "episodeId 参数格式错误" },
      { status: 400 },
    );
  }

  try {
    const items = await DanmakuService.getByEpisode(episodeId);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    logger.error("获取弹幕失败", error);
    return NextResponse.json({ error: "获取弹幕失败" }, { status: 500 });
  }
});

/**
 * POST /api/danmaku
 * 发送弹幕（需要登录）
 * Body: { episodeId, text, time, color?, type?, fontSize? }
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireUser(req);

  const body = await req.json();
  const { episodeId, text, time, color, type, fontSize } = body;

  if (typeof episodeId !== "number" || typeof text !== "string" || typeof time !== "number") {
    return NextResponse.json(
      { error: "参数不完整，需要 episodeId(number), text(string), time(number)" },
      { status: 400 },
    );
  }

  try {
    const danmaku = await DanmakuService.create({
      episodeId,
      text,
      time,
      color: typeof color === "string" ? color : undefined,
      type: typeof type === "number" && [0, 1, 2].includes(type) ? (type as 0 | 1 | 2) : undefined,
      fontSize: typeof fontSize === "number" ? fontSize : undefined,
      userId: user.userId,
    });

    return NextResponse.json({ success: true, data: danmaku }, { status: 201 });
  } catch (error) {
    logger.error("发送弹幕失败", error);
    return NextResponse.json({ error: "发送弹幕失败" }, { status: 500 });
  }
});
