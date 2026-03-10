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

export const GET = withApiHandler(async () => {
    const configs = await prisma.openlistConfig.findMany({
        orderBy: { id: "asc" },
        select: { id: true, name: true, host: true, createdAt: true }, // 不返回 token
    });
    return NextResponse.json(configs);
});

export const POST = withApiHandler(async (request: NextRequest) => {
    const json = await request.json().catch(() => null);
    const result = ConfigSchema.safeParse(json);

    if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }
    const { name, host, token } = result.data;

    // 测试连通性
    const client = createOpenListClient(host, token);
    const ok = await client.ping();
    if (!ok) {
        return NextResponse.json({ error: "无法连接到该 OpenList 实例，请检查 Host 和 Token" }, { status: 422 });
    }

    // 加密 token 后存储
    const encryptedToken = encrypt(token);
    const config = await prisma.openlistConfig.create({
        data: { name, host: host.replace(/\/$/, ""), token: encryptedToken },
    });

    return NextResponse.json({ id: config.id, name: config.name, host: config.host });
});
