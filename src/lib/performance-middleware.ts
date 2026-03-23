/**
 * 性能监控中间件
 * 自动记录所有 API 请求的性能指标
 */

import { NextRequest, NextResponse } from "next/server";
import { performanceMonitor } from "@/lib/performance-monitor";

/**
 * 为 API 路由启用性能监控
 * @example
 * export const GET = withPerformanceMonitoring(async (req) => {
 *   return NextResponse.json({ data: "..." });
 * }, "/api/users");
 */
export function withPerformanceMonitoring(
  handler: (
    req: NextRequest,
    ctx?: unknown,
  ) => Promise<Response | NextResponse>,
  endpoint: string,
  metadata?: Record<string, string | number | boolean>,
) {
  return async (request: NextRequest, ctx?: unknown) => {
    const startTime = Date.now();
    const method = request.method;

    try {
      const response = await handler(request, ctx);
      const duration = Date.now() - startTime;
      const statusCode = response.status || 200;

      performanceMonitor.recordMetric({
        endpoint,
        method,
        duration,
        statusCode,
        timestamp: Date.now(),
        success: statusCode >= 200 && statusCode < 300,
        metadata,
      });

      // 在响应头中添加性能指标
      const headers = new Headers(response.headers);
      headers.set("X-Response-Time", `${duration}ms`);

      return new NextResponse(response.body, {
        status: statusCode,
        statusText: response.statusText,
        headers,
      });
    } catch (err) {
      const duration = Date.now() - startTime;

      performanceMonitor.recordMetric({
        endpoint,
        method,
        duration,
        statusCode: 500,
        timestamp: Date.now(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata,
      });

      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  };
}
