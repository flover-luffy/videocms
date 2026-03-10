/**
 * 缓存管理 API
 * GET /api/admin/cache - 获取缓存统计
 * DELETE /api/admin/cache - 清空所有缓存
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { cacheManager } from "@/lib/cache";

/**
 * 获取缓存统计信息
 */
export const GET = withApiHandler(async () => {
    const stats = cacheManager.getStats();

    return NextResponse.json({
        caches: stats,
        totalItems: Object.values(stats).reduce((sum, count) => sum + count, 0),
    });
});

/**
 * 清空所有缓存
 */
export const DELETE = withApiHandler(async () => {
    cacheManager.clearAll();

    return NextResponse.json({
        message: "所有缓存已清空",
    });
});
