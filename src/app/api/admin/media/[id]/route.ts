import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";

/**
 * DELETE /api/admin/media/[id]
 * 删除指定的 Series 条目。
 * 此端点运行在 /api/admin/ 下，已经受过 middleware.ts 的 JWT 与 Admin Role 全局拦截保护。
 */
export const DELETE = withApiHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const seriesId = parseInt(id, 10);

    if (isNaN(seriesId)) {
        return NextResponse.json({ error: "Invalid media ID" }, { status: 400 });
    }

    // 由于在 src/prisma/schema.prisma 中为各种关联定义了 onDelete: Cascade
    // （例如 WatchProgress, Favorite, PlayEvent 和 Episode, Subtitle）
    // 所以我们只需直接 delete 该 Series 对象，关系库引擎将自动剥离所有级联历史。
    await prisma.series.delete({
        where: { id: seriesId }
    });

    return NextResponse.json({ success: true });
});
