import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { circuitBreakerRegistry } from "@/lib/circuit-breaker";
import { requireAdmin } from "@/lib/auth/require-auth";

/**
 * 断路器监控 API
 * GET /api/admin/circuit-breakers
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  await requireAdmin(request);
  try {
    const stats = circuitBreakerRegistry.getStats();

    // 分析整体状态
    const statusSummary = {
      totalBreakers: Object.keys(stats).length,
      healthyCount: Object.values(stats).filter((s) => s.state === "CLOSED")
        .length,
      openCount: Object.values(stats).filter((s) => s.state === "OPEN").length,
      halfOpenCount: Object.values(stats).filter((s) => s.state === "HALF_OPEN")
        .length,
      avgSuccessRate:
        Object.values(stats).reduce((sum, s) => {
          const rate =
            s.totalRequests > 0
              ? (s.totalSuccess / s.totalRequests) * 100
              : 100;
          return sum + rate;
        }, 0) / (Object.keys(stats).length || 1),
    };

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      summary: statusSummary,
      breakers: stats,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
});

/**
 * 重置断路器
 * POST /api/admin/circuit-breakers/reset?name=:breakerName
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  await requireAdmin(request);
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get("name");

    if (name) {
      const breaker = circuitBreakerRegistry.get(name);
      if (!breaker) {
        return NextResponse.json({ error: "断路器不存在" }, { status: 404 });
      }
      breaker.reset();
      return NextResponse.json({
        success: true,
        message: `断路器 '${name}' 已重置`,
      });
    }

    // 重置所有断路器
    for (const breaker of circuitBreakerRegistry.getAll().values()) {
      breaker.reset();
    }

    return NextResponse.json({
      success: true,
      message: "所有断路器已重置",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
});
