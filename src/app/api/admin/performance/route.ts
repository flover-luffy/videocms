import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import {
  performanceMonitor,
  generatePerformanceReport,
} from "@/lib/performance-monitor";
import { requireAdmin } from "@/lib/auth/require-auth";

/**
 * 性能监控 API
 * GET /api/admin/performance
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint");
  const type = url.searchParams.get("type") || "global"; // global, endpoint, slowest, errors, trends

  try {
    let data: unknown;

    switch (type) {
      case "endpoint":
        if (!endpoint) {
          return NextResponse.json(
            { error: "endpoint 参数必需（当type=endpoint时）" },
            { status: 400 },
          );
        }
        data = performanceMonitor.getEndpointMetrics(endpoint);
        break;

      case "endpoints":
        data = performanceMonitor.getEndpointsList();
        break;

      case "slowest":
        data = performanceMonitor.getSlowestRequests(20);
        break;

      case "errors":
        data = performanceMonitor.getRecentErrors(30);
        break;

      case "trends":
        const interval = parseInt(url.searchParams.get("interval") || "60", 10);
        data = performanceMonitor.getTrendMetrics(interval);
        break;

      case "report":
        data = generatePerformanceReport();
        break;

      case "global":
      default:
        data = performanceMonitor.getGlobalMetrics();
        break;
    }

    return NextResponse.json({
      success: true,
      type,
      timestamp: Date.now(),
      metricsCount: performanceMonitor.getMetricsCount(),
      data,
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
 * 清空性能监控数据
 * DELETE /api/admin/performance
 */
export const DELETE = withApiHandler(async (request: NextRequest) => {
  await requireAdmin(request);
  try {
    performanceMonitor.clear();
    return NextResponse.json({
      success: true,
      message: "性能监控数据已清空",
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
