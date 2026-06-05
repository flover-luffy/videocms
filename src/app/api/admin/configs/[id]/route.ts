import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { encrypt } from "@/lib/encryption";
import { requireAdmin } from "@/lib/auth/require-auth";
import { ConfigSchema } from "@/lib/validation";
import { assertAllowedOutboundUrl } from "@/lib/url-security";

/**
 * DELETE /api/admin/configs/[id]
 * 删除连接配置。注意：由于外键约束，建议先删除该配置下的所有影视剧集。
 */
export const DELETE = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireAdmin(request);
    const { id } = await context.params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
    }

    try {
      // 检查是否还有剧集关联到此配置
      const seriesCount = await prisma.series.count({
        where: { openlistConfigId: configId },
      });
      const albumCount = await prisma.album.count({
        where: { openlistConfigId: configId },
      });

      if (seriesCount > 0 || albumCount > 0) {
        return NextResponse.json(
          {
            error: `删除失败：该连接下仍有 ${seriesCount} 个剧集和 ${albumCount} 个专辑。请先在媒体控制台将其下架。`,
          },
          { status: 400 },
        );
      }

      await prisma.openlistConfig.delete({
        where: { id: configId },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      const { logger } = await import("@/lib/logger");
      logger.error("删除配置失败", error);
      return NextResponse.json({ error: "删除配置失败" }, { status: 500 });
    }
  },
);

/**
 * PUT /api/admin/configs/[id]
 * 修改连接配置。
 */
export const PUT = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireAdmin(request);
    const { id } = await context.params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const result = ConfigSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    const { name, host, token } = result.data;
    let normalizedHost: string;
    try {
      const allowedHost = await assertAllowedOutboundUrl(host);
      normalizedHost = allowedHost.toString().replace(/\/$/, "");
    } catch {
      return NextResponse.json(
        { error: "不允许的 OpenList Host 地址" },
        { status: 400 },
      );
    }

    try {
      // 加密 token 后更新
      const encryptedToken = encrypt(token);
      const updated = await prisma.openlistConfig.update({
        where: { id: configId },
        data: {
          name,
          host: normalizedHost,
          token: encryptedToken,
        },
        select: {
          id: true,
          name: true,
          host: true,
          createdAt: true,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      const { logger } = await import("@/lib/logger");
      logger.error("更新配置失败", error);
      return NextResponse.json({ error: "更新配置失败" }, { status: 500 });
    }
  },
);
