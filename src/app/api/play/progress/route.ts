import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { withApiHandler } from "@/lib/api-handler";
import { ProgressSchema } from "@/lib/validation";

/**
 * 播放进度同步 API
 * 获取/更新指定集数在当前用户下的播放进度（秒）
 */

import { ProgressService } from "@/services/progress.service";

/**
 * 播放进度同步 API
 * 获取/更新指定集数在当前用户下的播放进度（秒）
 */

export const GET = withApiHandler(async (request: NextRequest) => {
    const token = request.cookies.get("access_token")?.value;
    if (!token) return NextResponse.json({ position: 0 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ position: 0 });

    const { searchParams } = new URL(request.url);
    const episodeIdStr = searchParams.get("episodeId");
    if (!episodeIdStr) return NextResponse.json({ error: "Missing episodeId" }, { status: 400 });

    const episodeId = parseInt(episodeIdStr, 10);
    const result = await ProgressService.getProgress(payload.userId, episodeId);

    return NextResponse.json(result);
});

export const POST = withApiHandler(async (request: NextRequest) => {
    const token = request.cookies.get("access_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const json = await request.json().catch(() => null);
    const result = ProgressSchema.safeParse(json);

    if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { episodeId, position, duration } = result.data;
    const clientTimestamp = json?.clientTimestamp || Date.now();
    
    await ProgressService.syncProgress(payload.userId, episodeId, position, duration, clientTimestamp);

    return NextResponse.json({ success: true });
});
