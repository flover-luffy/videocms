import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";

/**
 * DELETE /api/admin/media
 * 清空所有 Series, Episode, Subtitle 等关联数据。
 */
export const DELETE = withApiHandler(async (request: NextRequest) => {
    // 强制确认机制：防止 CSRF 或 脚本误删
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== "delete-all-resources") {
        return NextResponse.json(
            { error: "安全保护：请在请求体中附带 { 'confirm': 'delete-all-resources' } 以执行清空操作" },
            { status: 400 }
        );
    }

    // SQLite 下最简单的全表清空方式
    await prisma.series.deleteMany({});
    // 由于 Cascade，Episode 等会自动删除
    return NextResponse.json({ success: true, message: "所有影视资源已清空" });
});
