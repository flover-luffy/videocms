import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOpenListClient } from "@/lib/openlist/client";
import { withApiHandler } from "@/lib/api-handler";
import { verifyToken } from "@/lib/auth/jwt";
import { getRequestAuthToken } from "@/lib/auth/request-token";
import { decrypt, isEncrypted } from "@/lib/encryption";

export const GET = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    // ── 认证层：必须登录才能获取音乐直链 ──
    const token = getRequestAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: "请先登录后在播放" }, { status: 401 });
    }
    const userPayload = await verifyToken(token);
    if (!userPayload) {
      return NextResponse.json(
        { error: "登录已过期，请重新登录" },
        { status: 401 },
      );
    }
    const { id } = await context.params;
    const trackId = parseInt(id, 10);

    if (isNaN(trackId)) {
      return NextResponse.json({ error: "Invalid track ID" }, { status: 400 });
    }

    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: {
        album: {
          include: { openlistConfig: true },
        },
      },
    });

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const config = track.album.openlistConfig;
    const decryptedToken = isEncrypted(config.token)
      ? decrypt(config.token)
      : config.token;
    const client = createOpenListClient(config.host, decryptedToken);

    const fileInfo = await client.getFile(track.openlistPath);
    const rawUrl = fileInfo.raw_url;

    // 我们对于常见音频拓展名尽量直接使用原始链，避免拖垮自有的 proxy 节点带宽
    return NextResponse.json({
      url: rawUrl,
      title: track.title,
      artist: track.artist || track.album.artist,
    });
  },
);
