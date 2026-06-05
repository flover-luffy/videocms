/**
 * OpenList 配置管理 API
 * GET  /api/admin/configs        - 列出所有配置
 * POST /api/admin/configs        - 新增配置
 * POST /api/admin/configs/test   - 测试连接
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOpenListClient } from "@/lib/openlist/client";
import { withApiHandler } from "@/lib/api-handler";
import { ConfigSchema } from "@/lib/validation";
import { encrypt } from "@/lib/encryption";
import { requireAdmin } from "@/lib/auth/require-auth";
import { enforceIdempotency } from "@/lib/idempotency";
import { assertAllowedOutboundUrl } from "@/lib/url-security";
import { logger } from "@/lib/logger";

export const GET = withApiHandler(async (request: NextRequest) => {
  await requireAdmin(request);
  try {
    const configs = await prisma.openlistConfig.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true, host: true, createdAt: true },
    });
    return NextResponse.json(configs);
  } catch (error) {
    logger.error("查询配置列表失败", error);
    return NextResponse.json({ error: "查询配置列表失败" }, { status: 500 });
  }
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireAdmin(request);

  // 幂等性防护：防止重复创建配置
  return enforceIdempotency(request, async () => {
    const json = await request.json().catch(() => null);
    const result = ConfigSchema.safeParse(json);

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
      // 测试连通性
      const client = createOpenListClient(normalizedHost, token);
      const ok = await client.ping();
      if (!ok) {
        return NextResponse.json(
          { error: "无法连接到该 OpenList 实例，请检查 Host 和 Token" },
          { status: 422 },
        );
      }

      // 加密 token 后存储
      const encryptedToken = encrypt(token);
      const config = await prisma.openlistConfig.create({
        data: { name, host: normalizedHost, token: encryptedToken },
      });

      return NextResponse.json({
        id: config.id,
        name: config.name,
        host: config.host,
      });
    } catch (error) {
      logger.error("创建配置失败", error);
      return NextResponse.json({ error: "创建配置失败" }, { status: 500 });
    }
  });
});
