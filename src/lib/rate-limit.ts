import { LRUCache } from "lru-cache";
import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT_CONFIG } from "@/config";
import { getClientIp } from "@/lib/server-utils";

/**
 * 速率限制配置
 */
interface RateLimitConfig {
  maxRequests: number; // 最大请求数
  windowMs: number; // 时间窗口（毫秒）
  maxCacheSize?: number; // 最大缓存条目数
}

/**
 * 创建速率限制中间件
 * ✅ 改进：避免竞态条件，确保计数正确
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { maxRequests, windowMs, maxCacheSize = 10000 } = config;

  const cache = new LRUCache<string, { count: number; resetTime: number }>({
    max: maxCacheSize,
    ttl: windowMs,
  });

  return (request: NextRequest) => {
    const ip = getClientIp(request);

    const now = Date.now();
    const record = cache.get(ip);

    // ✅ Step 1: 如果记录不存在或已过期，重置
    if (!record || now > record.resetTime) {
      cache.set(ip, { count: 1, resetTime: now + windowMs });
      return null; // 允许请求
    }

    // ✅ Step 2: 在更新前检查限制（避免 TOCTOU 竞态）
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

    // ✅ Step 3: 更新计数（现在检查已通过）
    record.count++;
    cache.set(ip, record);

    return null; // 允许请求
  };
}

/**
 * 预定义的速率限制配置
 */
export const RATE_LIMITS = {
  // 搜索端点
  search: {
    maxRequests: RATE_LIMIT_CONFIG.SEARCH.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.SEARCH.windowMs,
  },

  // 导入端点
  import: {
    maxRequests: RATE_LIMIT_CONFIG.IMPORT.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.IMPORT.windowMs,
  },

  // 播放进度
  progress: {
    maxRequests: RATE_LIMIT_CONFIG.PROGRESS.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.PROGRESS.windowMs,
  },

  // 通用 API
  api: {
    maxRequests: RATE_LIMIT_CONFIG.API.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.API.windowMs,
  },
  // 认证相关（登录、找回密码等）
  auth: {
    maxRequests: RATE_LIMIT_CONFIG.AUTH.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.AUTH.windowMs,
  },
};
