import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { SearchSchema } from "@/lib/validation";
import { createRateLimiter, RATE_LIMITS } from "@/lib/rate-limit";
import { API_TIMEOUT_CONFIG } from "@/config";
import { searchCache } from "@/lib/cache";
import { withPerformanceMonitoring } from "@/lib/performance-middleware";
import crypto from "crypto";

const rateLimiter = createRateLimiter(RATE_LIMITS.search);

/**
 * 生成规范化的搜索缓存键
 */
function generateSearchCacheKey(
  query: string,
  type: string,
  page: number,
  limit: number,
  userId?: string,
): string {
  const cacheVersion = "v1";
  const normalizedQuery = query.toLowerCase().trim();

  // 使用 SHA256 哈希确保缓存键长度固定且规范化
  const keyMaterial = [
    cacheVersion,
    normalizedQuery,
    type,
    String(page),
    String(limit),
    userId || "anon",
  ].join(":");

  const hash = crypto
    .createHash("sha256")
    .update(keyMaterial)
    .digest("hex")
    .substring(0, 16);

  return `search:${hash}`;
}

/**
 * 全局搜索接口
 * GET /api/search?q=xxx&type=all&page=1&limit=20
 */
const searchHandler = withApiHandler(
  async (request: NextRequest) => {
    // 应用速率限制
    const rateLimitResponse = rateLimiter(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const type = searchParams.get("type") ?? "all";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );

    // 验证输入
    const result = SearchSchema.safeParse({ q: query, type });
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    const { q } = result.data;

    // 获取用户 ID（可选，用于个性化搜索）
    const userId = request.headers.get("x-user-id");

    // 生成规范化的缓存键
    const cacheKey = generateSearchCacheKey(
      q,
      type,
      page,
      limit,
      userId || undefined,
    );

    // 尝试从缓存获取
    const cached = await searchCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 使用 Prisma ORM 进行安全的多字段模糊检索
    try {
      // 构建安全的搜索条件
      const searchConditions = {
        OR: [
          { title: { contains: q } },
          { director: { contains: q } },
          // SQLite 不支持 JSON 字段搜索，需要使用原生查询但使用安全的 $queryRaw
        ],
      };

      // 获取总数
      const total = await prisma.series.count({
        where: searchConditions,
      });

      if (total === 0) {
        return NextResponse.json({
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        });
      }

      // 获取分页数据
      const items = await prisma.series.findMany({
        where: searchConditions,
        select: {
          id: true,
          title: true,
          type: true,
          posterUrl: true,
          year: true,
          voteAverage: true,
          _count: { select: { episodes: true } },
        },
        orderBy: [{ playCount: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      });

      const formatted = items.map((s) => ({
        ...s,
        episodeCount: s._count.episodes,
        _count: undefined,
      }));

      const response = {
        items: formatted,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      // 缓存结果
      await searchCache.set(cacheKey, response, 300); // 5分钟 TTL

      return NextResponse.json(response);
    } catch (err) {
      console.error("[Search] 搜索执行失败:", err);
      return NextResponse.json(
        { error: "搜索服务暂时不可用" },
        { status: 500 },
      );
    }
  },
  { timeout: API_TIMEOUT_CONFIG.SEARCH },
);

// 包装性能监控：自动记录搜索端点的响应时间和成功率
export const GET = withPerformanceMonitoring(searchHandler, "/api/search");
