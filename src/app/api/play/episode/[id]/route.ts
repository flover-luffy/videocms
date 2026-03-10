/**
 * 播放直链获取 API
 * GET /api/play/episode/[id]
 *
 * 安全模型：
 * - 必须携带有效 JWT Token，未登录用户无法获取任何直链
 * - 直链由 OpenList 颁发，自带时效签名（通常数小时有效）
 * - 即使直链被复制，OpenList 签名过期后自动失效
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOpenListClient } from "@/lib/openlist/client";
import type { PlayUrlResult } from "@/types";
import { withApiHandler } from "@/lib/api-handler";
import { verifyToken } from "@/lib/auth/jwt";
import { getClientIp } from "@/lib/server-utils";


export const GET = withApiHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    // ── 认证层：必须登录才能获取播放直链 ──
    const token = request.cookies.get("access_token")?.value || request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
        return NextResponse.json({ error: "请先登录后再播放" }, { status: 401 });
    }
    const userPayload = await verifyToken(token);
    if (!userPayload) {
        return NextResponse.json({ error: "登录已过期，请重新登录" }, { status: 401 });
    }

    const { id } = await params;
    const episodeId = parseInt(id, 10);

    if (isNaN(episodeId)) {
        return NextResponse.json({ error: "无效的集数 ID" }, { status: 400 });
    }

    // 查询集数及关联的 Series 配置
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: {
            series: {
                include: { openlistConfig: true },
            },
        },
    });

    if (!episode) {
        return NextResponse.json({ error: "集数不存在" }, { status: 404 });
    }

    const config = episode.series.openlistConfig;

    // 解密 token（如果已加密）
    const { decrypt, isEncrypted } = await import("@/lib/encryption");
    const decryptedToken = isEncrypted(config.token) ? decrypt(config.token) : config.token;
    const client = createOpenListClient(config.host, decryptedToken);

    // 实时获取视频直链与代理链
    let url: string;
    let rawUrl: string;
    const subtitles: PlayUrlResult["subtitles"] = [];

    try {
        const fileInfo = await client.getFile(episode.openlistPath);
        rawUrl = fileInfo.raw_url;
        url = client.getProxyUrl(episode.openlistPath, fileInfo.sign);

        // ── 字幕关联逻辑 ──
        // 获取父目录及视频基础名（不含后缀）
        const lastSlash = episode.openlistPath.lastIndexOf("/");
        const parentPath = lastSlash >= 0 ? episode.openlistPath.substring(0, lastSlash) : "/";
        const fileName = episode.openlistPath.split("/").pop() || "";
        const baseName = fileName.lastIndexOf(".") >= 0 ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName;

        // 获取目录列表扫描同名字幕
        const dirFiles = await client.listDir(parentPath);
        const subtitleExts = [".srt", ".vtt", ".ass"];

        for (const f of dirFiles) {
            if (f.is_dir) continue;
            const extDot = f.name.lastIndexOf(".");
            if (extDot === -1) continue;
            const ext = f.name.slice(extDot).toLowerCase();
            const nameWithoutExt = f.name.slice(0, extDot);

            // 匹配条件：扩展名正确 且 基础名相同（或者是基础名开头，如 EP01.zh.srt）
            if (subtitleExts.includes(ext) && nameWithoutExt.startsWith(baseName)) {
                try {
                    // 调用 getFile 获取真实 sign，而非依赖目录列表（目录列表 sign 可能为空）
                    const subtitlePath = `${parentPath}/${f.name}`;
                    const subInfo = await client.getFile(subtitlePath);
                    subtitles.push({
                        url: client.getProxyUrl(subtitlePath, subInfo.sign),
                        name: f.name,
                        type: ext.slice(1) as "srt" | "vtt" | "ass",
                    });
                } catch {
                    // 单个字幕获取失败不影响视频播放
                    console.warn(`[PlayAPI] 字幕文件获取失败，跳过: ${f.name}`);
                }
            }
        }
    } catch (err) {
        console.error("[PlayAPI] 获取资源失败:", err);
        return NextResponse.json({ error: "获取视频资源失败，请稍后重试" }, { status: 502 });
    }

    const result: PlayUrlResult = {
        url: url,
        rawUrl: rawUrl,
        subtitles: subtitles.length > 0 ? subtitles : undefined,
    };

    // 播放统计防刷逻辑：24 小时内同一 IP 只计数一次
    const ip = getClientIp(request);
    const userId = userPayload.userId;
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    // 异步处理播放统计（不阻塞响应）
    (async () => {
        try {
            const recentPlay = await prisma.playEvent.findFirst({
                where: {
                    seriesId: episode.seriesId,
                    ip,
                    createdAt: { gte: oneDayAgo },
                },
            });

            // 如果 24 小时内没有播放记录，则增加计数
            if (!recentPlay) {
                await prisma.$transaction([
                    // 记录播放事件
                    prisma.playEvent.create({
                        data: {
                            seriesId: episode.seriesId,
                            ip,
                            userId,
                        },
                    }),
                    // 增加播放次数
                    prisma.series.update({
                        where: { id: episode.seriesId },
                        data: { playCount: { increment: 1 } },
                    }),
                ]);
            }
        } catch (err) {
            console.error("[PlayAPI] 播放统计更新失败:", err);
        }
    })();

    return NextResponse.json(result);
});
