import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { addSecurityHeaders } from "@/lib/security-headers";

// Middleware 运行在 Edge Runtime，因此需独立定义 SECRET，保持与 jwt.ts 逻辑一致
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("🚨 [FATAL] 生产环境中未设置 JWT_SECRET!");
  }
  console.warn("⚠️ [SECURITY] 生产环境中未设置 JWT_SECRET!");
}

import { CsrfProtection } from "@/lib/csrf-protection";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret-do-not-use-in-production",
);

// ========== Edge-compatible Rate Limiter ==========
// Edge Runtime 不支持 lru-cache（依赖 Node.js API），使用 Map 实现轻量级限流
interface RateRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateRecord>();
const AUTH_RATE_LIMIT = { maxRequests: 5, windowMs: 15 * 60 * 1000 }; // 登录：15 分钟 5 次
const API_RATE_LIMIT = { maxRequests: 60, windowMs: 60 * 1000 }; // API 通用：1 分钟 60 次

/** 每 5 分钟清理过期条目，防止内存无限增长 */
let lastCleanup = Date.now();
function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetTime) rateLimitStore.delete(key);
  }
}

/** 检查是否被限流，返回 429 响应或 null（允许通过） */
function checkRateLimit(
  ip: string,
  prefix: string,
  config: { maxRequests: number; windowMs: number },
): NextResponse | null {
  cleanupExpiredEntries();
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return null;
  }

  record.count++;
  rateLimitStore.set(key, record);

  if (record.count > config.maxRequests) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((record.resetTime - now) / 1000)),
        },
      },
    );
  }
  return null;
}

/** 从请求头提取客户端 IP */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. 处理 CORS 预检请求
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":
          process.env.API_ALLOWED_ORIGINS || "http://localhost:3000",
        "Access-Control-Allow-Methods":
          "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, Idempotency-Key",
        "Access-Control-Max-Age": "86400",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }

  // 1. CSRF 防护校验（针对 POST/PUT/DELETE/PATCH）
  const csrfError = CsrfProtection.middleware(request);
  if (csrfError) return csrfError;

  // 2. 速率限制
  if (pathname.startsWith("/api/")) {
    const clientIp = getClientIp(request);

    // 登录端点特殊限流（防暴力破解）
    if (pathname === "/api/auth/login" && request.method === "POST") {
      const rateLimitResponse = checkRateLimit(
        clientIp,
        "auth",
        AUTH_RATE_LIMIT,
      );
      if (rateLimitResponse) return rateLimitResponse;
    }

    // API 全局通用限流
    const rateLimitResponse = checkRateLimit(clientIp, "api", API_RATE_LIMIT);
    if (rateLimitResponse) return rateLimitResponse;
  }

  // 拦截访问受保护的路径（管理员路径或用户私有路径）
  const isAdminPath =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isUserPath =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/favorites") ||
    pathname.startsWith("/api/user");

  if (isAdminPath || isUserPath) {
    const token =
      request.cookies.get("access_token")?.value ||
      request.headers.get("Authorization")?.split(" ")[1];

    if (!token) {
      return handleUnauthorized(request);
    }

    try {
      const { payload } = await jwtVerify(token, SECRET);

      // 如果访问管理员路径，校验是否为管理员
      if (isAdminPath && payload.role !== "admin") {
        return handleUnauthorized(request);
      }
    } catch {
      // Token 验证失败（过期、篡改等）
      return handleUnauthorized(request);
    }
  }

  // ======= 3. Nonce CSP 安全机制注入 =======
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce); // 供 Next.js 服务端组件与 <script> 标签抓取

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 2. 自动补充 CSRF Cookie（如果缺失）
  if (!request.cookies.has("__csrf_token")) {
    CsrfProtection.setCsrfCookie(response);
  }

  // 3. 添加 CORS 头
  response.headers.set(
    "Access-Control-Allow-Origin",
    process.env.API_ALLOWED_ORIGINS || "http://localhost:3000",
  );
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key",
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");

  return addSecurityHeaders(response, nonce, pathname);
}

/** 统一处理未授权访问 */
function handleUnauthorized(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized or insufficient permissions" },
      { status: 401 },
    );
  } else {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname); // 可选保存原目标路径
    return NextResponse.redirect(url);
  }
}

// 匹配所有请求路径，排除静态资源和 API 限流以外的特殊路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (图标)
     * - 各类静态资源和媒体文件
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|css|js|mp4|webm|mkv)$).*)",
  ],
};
