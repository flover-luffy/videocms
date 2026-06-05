import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { getRequestAuthToken } from "@/lib/auth/request-token";
import { requireUser } from "@/lib/auth/require-auth";
import { withApiHandler } from "@/lib/api-handler";
import { ProgressSchema } from "@/lib/validation";
import { ProgressService } from "@/services/progress.service";
import { logger } from "@/lib/logger";

export const GET = withApiHandler(async (request: NextRequest) => {
  const token = getRequestAuthToken(request);
  if (!token) {
    return NextResponse.json({ position: 0 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ position: 0 });
  }

  const { searchParams } = new URL(request.url);
  const episodeIdStr = searchParams.get("episodeId");
  if (!episodeIdStr) {
    return NextResponse.json({ error: "Missing episodeId" }, { status: 400 });
  }

  const episodeId = Number.parseInt(episodeIdStr, 10);
  if (!Number.isFinite(episodeId) || episodeId <= 0) {
    return NextResponse.json({ error: "Invalid episodeId" }, { status: 400 });
  }

  try {
    const result = await ProgressService.getProgress(payload.userId, episodeId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("获取播放进度失败", error);
    return NextResponse.json({ error: "获取播放进度失败" }, { status: 500 });
  }
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const user = await requireUser(request);

  const json = await request.json().catch(() => null);
  const result = ProgressSchema.safeParse(json);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  const { episodeId, position, duration } = result.data;
  const clientTimestamp = json?.clientTimestamp || Date.now();

  try {
    await ProgressService.syncProgress(
      user.userId,
      episodeId,
      position,
      duration,
      clientTimestamp,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("同步播放进度失败", error);
    return NextResponse.json({ error: "同步播放进度失败" }, { status: 500 });
  }
});
