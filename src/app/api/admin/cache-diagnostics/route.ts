import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import {
  getCacheDiagnostics,
  checkRedisConnection,
  searchCache,
} from "@/lib/cache";
import { requireAdmin } from "@/lib/auth/require-auth";

type CacheTestResult = {
  testStartTime: string;
  write?: string;
  read?: string;
  dataMatch?: boolean;
  expected?: object;
  received?: object | null;
  cleanup?: string;
  error?: string;
  status?: string;
  cacheSize?: number | string;
};

type CacheDiagnosticsSummary = {
  redisConfigured?: boolean;
  redisConnected?: string;
};

/**
 * 缓存诊断接口
 * 检查缓存系统是否正常运行，Redis 是否真的生效
 * GET /api/admin/cache-diagnostics
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  await requireAdmin(request);
  try {
    // 获取基础诊断信息
    const diagnostics = await getCacheDiagnostics();

    // 检查 Redis 连接
    const redisConnected = await checkRedisConnection();
    const diagnosticsWithConnection = {
      ...diagnostics,
      redisConnected: redisConnected ? "✅ 已连接" : "❌ 未连接",
    };

    // 测试搜索缓存
    const testKey = "cache-diagnostic-test";
    const testValue = {
      test: true,
      timestamp: Date.now(),
      random: Math.random(),
    };

    const cacheTest: CacheTestResult = {
      testStartTime: new Date().toISOString(),
    };

    try {
      // 写入测试数据
      await searchCache.set(testKey, testValue, 60);
      cacheTest.write = "✅ 成功";

      // 等待一下，确保数据已持久化（如果是 Redis）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 读取测试数据
      const retrieved = await searchCache.get(testKey);
      if (
        retrieved &&
        typeof retrieved === "object" &&
        "test" in retrieved &&
        retrieved.test === true
      ) {
        cacheTest.read = "✅ 成功";
        cacheTest.dataMatch = true;
      } else {
        cacheTest.read = "❌ 失败";
        cacheTest.dataMatch = false;
        cacheTest.expected = testValue;
        cacheTest.received = retrieved;
      }

      // 清理测试数据
      await searchCache.delete(testKey);
      cacheTest.cleanup = "✅ 完成";
    } catch (err) {
      cacheTest.error = err instanceof Error ? err.message : String(err);
      cacheTest.status = "❌ 异常";
    }

    // 检查缓存大小
    try {
      const size = await searchCache.size();
      cacheTest.cacheSize = size;
    } catch (err) {
      cacheTest.cacheSize = `获取失败: ${err instanceof Error ? err.message : String(err)}`;
    }

    return NextResponse.json({
      success: true,
      systemDiagnostics: diagnosticsWithConnection,
      cacheTest,
      recommendation: getRecommendation(diagnosticsWithConnection, cacheTest),
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

function getRecommendation(
  diagnostics: CacheDiagnosticsSummary,
  cacheTest: CacheTestResult,
): string {
  const issues: string[] = [];

  if (diagnostics.redisConfigured === false) {
    issues.push("Redis 未配置，系统使用内存缓存");
  }

  if (diagnostics.redisConnected?.includes("未连接")) {
    issues.push("⚠️ Redis 已配置但未连接，检查网络/Redis 服务");
  }

  if (cacheTest.read === "❌ 失败") {
    issues.push("⚠️ 缓存读写测试失败，可能的原因：Redis 故障、权限问题");
  }

  if (issues.length === 0) {
    return "✅ 缓存系统运行正常，Redis 已正确配置并可用。";
  }

  return issues.join(" | ");
}
