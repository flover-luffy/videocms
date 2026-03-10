import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { encrypt } from "@/lib/encryption";

/**
 * DELETE /api/admin/configs/[id]
 * 删除连接配置。注意：由于外键约束，建议先删除该配置下的所有影视剧集。
 */
export const DELETE = withApiHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
        return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
    }

    // 检查是否还有剧集关联到此配置
    const seriesCount = await prisma.series.count({ where: { openlistConfigId: configId } });
    const albumCount = await prisma.album.count({ where: { openlistConfigId: configId } });

    if (seriesCount > 0 || albumCount > 0) {
        return NextResponse.json({
            error: `删除失败：该连接下仍有 ${seriesCount} 个剧集和 ${albumCount} 个专辑。请先在媒体控制台将其下架。`
        }, { status: 400 });
    }

    await prisma.openlistConfig.delete({
        where: { id: configId }
    });

    return NextResponse.json({ success: true });
});

/**
 * PUT /api/admin/configs/[id]
 * 修改连接配置。
 */
export const PUT = withApiHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
        return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.name || !body.host || !body.token) {
        return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    // 加密 token 后更新
    const encryptedToken = encrypt(body.token);
    const updated = await prisma.openlistConfig.update({
        where: { id: configId },
        data: {
            name: body.name,
            host: body.host,
            token: encryptedToken,
        }
    });

    return NextResponse.json(updated);
});
