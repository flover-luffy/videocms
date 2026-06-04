/**
 * CSRF (Cross-Site Request Forgery) 保护
 * 为状态改变操作提供CSRF token验证
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cacheManager } from "./cache";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_TTL = 60 * 60; // 1小时（秒）
const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf-token";

// 使用cache manager存储CSRF tokens
const csrfCache = cacheManager.getCache<{ token: string }>("csrf-tokens", 10000, CSRF_TOKEN_TTL);

/**
 * 生成CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * 存储CSRF token到缓存（关联到session/user）
 */
export async function storeCsrfToken(
  userId: number | string,
  token: string
): Promise<void> {
  const key = `${userId}`;
  try {
    await csrfCache.set(key, { token }, CSRF_TOKEN_TTL);
  } catch (error) {
    console.error("[CSRF] Failed to store token:", error);
  }
}

/**
 * 验证CSRF token
 */
export async function verifyCsrfToken(
  userId: number | string,
  token: string
): Promise<boolean> {
  const key = `${userId}`;
  try {
    const cached = await csrfCache.get(key);
    if (!cached?.token) return false;

    // 使用constant-time比较防止时序攻击
    return crypto.timingSafeEqual(
      Buffer.from(cached.token),
      Buffer.from(token)
    );
  } catch (error) {
    console.error("[CSRF] Token verification failed:", error);
    // SECURITY: Fail-closed - 验证失败时拒绝请求
    return false;
  }
}

/**
 * CSRF保护中间件
 * 用于保护POST/PUT/DELETE/PATCH请求
 */
export async function csrfProtection(
  req: NextRequest,
  userId: number | string
): Promise<NextResponse | null> {
  // 只保护状态改变方法
  const method = req.method;
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return null;
  }

  // 从header或cookie获取token
  const tokenFromHeader = req.headers.get(CSRF_HEADER);
  const tokenFromCookie = req.cookies.get(CSRF_COOKIE)?.value;
  const token = tokenFromHeader || tokenFromCookie;

  if (!token) {
    return NextResponse.json(
      { error: "CSRF token missing" },
      { status: 403 }
    );
  }

  const isValid = await verifyCsrfToken(userId, token);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid CSRF token" },
      { status: 403 }
    );
  }

  return null;
}

/**
 * 为响应设置CSRF token cookie
 */
export function setCsrfTokenCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: CSRF_TOKEN_TTL,
    path: "/",
  });

  return response;
}
