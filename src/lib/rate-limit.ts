import { LRUCache } from "lru-cache";
import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT_CONFIG } from "@/config";
import { getClientIp } from "@/lib/server-utils";
import { cacheManager } from "@/lib/cache";

/**
 * 速率限制配置
 */
interface RateLimitConfig {
  maxRequests: number; // 最大请求数
  windowMs: number; // 时间窗口（毫秒）
  maxCacheSize?: number; // 最大缓存条目数
  name?: string; // 分布式缓存命名空间
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * 创建速率限制中间件
 * Redis 可用时使用分布式缓存；否则回退到当前进程内存。
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { maxRequests, windowMs, maxCacheSize = 10000 } = config;
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const namespace = config.name ?? `${maxRequests}-${windowMs}`;
  const distributedCache = cacheManager.getCache<RateLimitRecord>(
    `rate-limit-${namespace}`,
    maxCacheSize,
    ttlSeconds,
  );

  const fallbackCache = new LRUCache<string, RateLimitRecord>({
    max: maxCacheSize,
    ttl: windowMs,
  });

  return async (request: NextRequest) => {
    const ip = getClientIp(request);
    const now = Date.now();
    let record: RateLimitRecord | null;

    try {
      record = (await distributedCache.get(ip)) ?? fallbackCache.get(ip) ?? null;
    } catch (error) {
      console.error("[RateLimit] 分布式限流缓存读取失败，回退到内存", error);
      record = fallbackCache.get(ip) ?? null;
    }

    if (!record || now > record.resetTime) {
      const nextRecord = { count: 1, resetTime: now + windowMs };
      await distributedCache.set(ip, nextRecord, ttlSeconds);
      fallbackCache.set(ip, nextRecord);
      return null;
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
            "X-RateLimit-Limit": maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": record.resetTime.toString(),
          },
        },
      );
    }

    record.count++;
    const remainingTtlSeconds = Math.max(
      1,
      Math.ceil((record.resetTime - now) / 1000),
    );
    await distributedCache.set(ip, record, remainingTtlSeconds);
    fallbackCache.set(ip, record, { ttl: remainingTtlSeconds * 1000 });

    return null;
  };
}

/**
 * 预定义的速率限制配置
 */
export const RATE_LIMITS = {
  // 搜索端点
  search: {
    name: "search",
    maxRequests: RATE_LIMIT_CONFIG.SEARCH.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.SEARCH.windowMs,
  },

  // 导入端点
  import: {
    name: "import",
    maxRequests: RATE_LIMIT_CONFIG.IMPORT.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.IMPORT.windowMs,
  },

  // 播放进度
  progress: {
    name: "progress",
    maxRequests: RATE_LIMIT_CONFIG.PROGRESS.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.PROGRESS.windowMs,
  },

  // 通用 API
  api: {
    name: "api",
    maxRequests: RATE_LIMIT_CONFIG.API.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.API.windowMs,
  },
  // 认证相关（登录、找回密码等）
  auth: {
    name: "auth",
    maxRequests: RATE_LIMIT_CONFIG.AUTH.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.AUTH.windowMs,
  },
};
