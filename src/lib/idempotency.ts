import { NextRequest, NextResponse } from "next/server";
import { cacheManager } from "@/lib/cache";

interface IdempotencyResponse {
  headers: Record<string, string>;
  body: string;
  status: number;
}

/**
 * 幂等性密钥缓存配置
 */
const IDEMPOTENCY_CACHE_TTL = 24 * 60 * 60; // 24 小时 (秒数)

// 获取幂等性缓存实例
const idempotencyCache = cacheManager.getCache<IdempotencyResponse>(
  "idempotency",
  1000,
  IDEMPOTENCY_CACHE_TTL,
);

/**
 * 检查并缓存幂等性请求（可选模式）
 * 用于 POST/PUT/PATCH 操作防止重复提交
 *
 * 可选模式：如果请求包含 Idempotency-Key 头则启用幂等防护，
 * 没有该头的请求正常通过，不影响现有行为。
 */
export async function enforceIdempotency(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const idempotencyKey = request.headers.get("idempotency-key");

  // 可选模式：没有幂等性密钥时直接执行 handler
  if (!idempotencyKey) {
    return handler();
  }

  // 验证幂等性密钥格式（至少 8 位字母数字或连字符）
  if (!/^[a-z0-9\-]{8,}$/i.test(idempotencyKey)) {
    return NextResponse.json(
      {
        error: "无效的幂等性密钥",
        errorCode: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key 必须是有效的 UUID 或标识符（至少 8 位）",
      },
      { status: 400 },
    );
  }

  const cacheKey = `idempotency:${idempotencyKey}`;

  // 检查是否已处理过此请求
  const cachedResult = await idempotencyCache.get(cacheKey);
  if (cachedResult) {
    const response = new NextResponse(cachedResult.body, {
      status: cachedResult.status,
      headers: cachedResult.headers,
    });
    response.headers.set("x-idempotency-cache", "hit");
    return response;
  }

  // 执行实际的处理程序
  const response = await handler();

  // 仅缓存成功的响应（2xx 和 4xx，不缓存 5xx）
  if (response.status < 500) {
    const body = await response.text();
    const cachedResponse: IdempotencyResponse = {
      headers: Object.fromEntries(response.headers.entries()),
      body,
      status: response.status,
    };

    await idempotencyCache.set(cacheKey, cachedResponse, IDEMPOTENCY_CACHE_TTL);

    const newResponse = new NextResponse(body, {
      status: response.status,
      headers: response.headers,
    });
    newResponse.headers.set("x-idempotency-cache", "miss");
    return newResponse;
  }

  // 服务器错误不缓存
  return response;
}

/**
 * 清除幂等性缓存（当需要强制重新处理时）
 */
export async function clearIdempotencyCache(
  idempotencyKey: string,
): Promise<void> {
  const cacheKey = `idempotency:${idempotencyKey}`;
  await idempotencyCache.delete(cacheKey);
}
