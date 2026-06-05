import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

/**
 * DELETE /api/admin/media/[id]
 * 删除指定的 Series 条目。
 * 此端点运行在 /api/admin/ 下，已经受过 middleware.ts 的 JWT 与 Admin Role 全局拦截保护。
 */
export const DELETE = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireAdmin(request);
    const { id } = await context.params;
    const seriesId = parseInt(id, 10);

    if (isNaN(seriesId)) {
      return NextResponse.json({ error: "Invalid media ID" }, { status: 400 });
    }

    // 后台敏感操作防误删二次确认：强校验客户端传递的确切删除意图头
    const confirmHeader = request.headers.get("x-confirm-delete");
    if (confirmHeader !== "true") {
      return NextResponse.json(
        {
          error:
            "This is a destructive operation. Please provide 'x-confirm-delete: true' header to proceed.",
        },
        { status: 428 }, // 428 Precondition Required
      );
    }

    try {
      // 由于在 src/prisma/schema.prisma 中为各种关联定义了 onDelete: Cascade
      // （例如 WatchProgress, Favorite, PlayEvent 和 Episode, Subtitle）
      // 所以我们只需直接 delete 该 Series 对象，关系库引擎将自动剥离所有级联历史。
      await prisma.series.delete({
        where: { id: seriesId },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error("删除媒体失败", error);
      return NextResponse.json({ error: "删除媒体失败" }, { status: 500 });
    }
  },
);
