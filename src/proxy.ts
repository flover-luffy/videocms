import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { importSPKI, jwtVerify } from "jose";
import { addSecurityHeaders } from "@/lib/security-headers";
import { CsrfProtection } from "@/lib/csrf-protection";
import { getClientIp } from "@/lib/server-utils";

const JWT_ALG = "RS256";
const DEFAULT_ALLOWED_ORIGIN = "http://localhost:3000";
const MAX_RATE_LIMIT_KEYS = 20_000;

const jwtPublicKey = normalizePublicKey(process.env.JWT_PUBLIC_KEY);
let publicKeyPromise: ReturnType<typeof importSPKI> | null = null;

type RateRecord = { count: number; resetTime: number };

const rateLimitStore = new Map<string, RateRecord>();
const AUTH_RATE_LIMIT = { maxRequests: 5, windowMs: 15 * 60 * 1000 };
const API_RATE_LIMIT = { maxRequests: 60, windowMs: 60 * 1000 };

let lastCleanup = Date.now();

function normalizePublicKey(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    throw new Error("[FATAL] JWT_PUBLIC_KEY is not configured");
  }
  if (/(fallback|replace[_-]?with|placeholder|changeme|dummy|example)/i.test(raw)) {
    throw new Error("[FATAL] JWT_PUBLIC_KEY uses an insecure placeholder value");
  }

  const pem = raw.includes("-----BEGIN")
    ? raw.replace(/\\n/g, "\n")
    : atob(raw).replace(/\\n/g, "\n");

  if (!pem.includes("-----BEGIN PUBLIC KEY-----")) {
    throw new Error("[FATAL] JWT_PUBLIC_KEY must be a PEM key or base64 encoded PEM");
  }

  return pem;
}

function getJwtPublicKey() {
  publicKeyPromise ??= importSPKI(jwtPublicKey, JWT_ALG);
  return publicKeyPromise;
}

function getConfiguredCorsOrigins(): string[] {
  const raw =
    process.env.API_ALLOWED_ORIGINS ||
    process.env.ALLOWED_ORIGINS ||
    DEFAULT_ALLOWED_ORIGIN;

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveCorsOrigin(request: NextRequest): string {
  const allowedOrigins = getConfiguredCorsOrigins();
  const requestOrigin = request.headers.get("origin")?.trim();

  if (!requestOrigin) {
    return allowedOrigins[0] ?? DEFAULT_ALLOWED_ORIGIN;
  }

  if (allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] ?? DEFAULT_ALLOWED_ORIGIN;
}

function applyCorsHeaders(
  response: NextResponse,
  allowedOrigin: string,
  includeMaxAge = false,
): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key",
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");

  if (includeMaxAge) {
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;

  lastCleanup = now;
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

function evictRateLimitEntries() {
  if (rateLimitStore.size < MAX_RATE_LIMIT_KEYS) {
    return;
  }

  cleanupExpiredEntries();
  if (rateLimitStore.size < MAX_RATE_LIMIT_KEYS) {
    return;
  }

  const overflow = rateLimitStore.size - MAX_RATE_LIMIT_KEYS + 1;
  let removed = 0;
  for (const key of rateLimitStore.keys()) {
    rateLimitStore.delete(key);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
}

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
    evictRateLimitEntries();
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return null;
  }

  record.count += 1;
  rateLimitStore.set(key, record);

  if (record.count > config.maxRequests) {
    return NextResponse.json(
      { error: "Too many requests, please try again later" },
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

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return null;

  const match = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(
    authorization.trim(),
  );
  return match?.[1] ?? null;
}

function handleUnauthorized(request: NextRequest, allowedOrigin: string) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json(
      { error: "Unauthorized or insufficient permissions" },
      { status: 401 },
    );
    return applyCorsHeaders(response, allowedOrigin);
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const allowedOrigin = resolveCorsOrigin(request);

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return applyCorsHeaders(response, allowedOrigin, true);
  }

  const csrfError = CsrfProtection.middleware(request);
  if (csrfError) return csrfError;

  if (pathname.startsWith("/api/")) {
    const clientIp = getClientIp(request);

    if (pathname === "/api/auth/login" && request.method === "POST") {
      const authRateLimitResponse = checkRateLimit(
        clientIp,
        "auth",
        AUTH_RATE_LIMIT,
      );
      if (authRateLimitResponse) {
        return applyCorsHeaders(authRateLimitResponse, allowedOrigin);
      }
    }

    const apiRateLimitResponse = checkRateLimit(clientIp, "api", API_RATE_LIMIT);
    if (apiRateLimitResponse) {
      return applyCorsHeaders(apiRateLimitResponse, allowedOrigin);
    }
  }

  const isAdminPath =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isUserPath =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/favorites") ||
    pathname.startsWith("/api/user");

  if (isAdminPath || isUserPath) {
    const token =
      request.cookies.get("access_token")?.value || extractBearerToken(request);

    if (!token) {
      return handleUnauthorized(request, allowedOrigin);
    }

    try {
      const { payload } = await jwtVerify(token, await getJwtPublicKey(), {
        algorithms: [JWT_ALG],
      });

      if (isAdminPath && payload.role !== "admin") {
        return handleUnauthorized(request, allowedOrigin);
      }
    } catch {
      return handleUnauthorized(request, allowedOrigin);
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (!request.cookies.has("__csrf_token")) {
    CsrfProtection.setCsrfCookie(response);
  }

  applyCorsHeaders(response, allowedOrigin);
  return addSecurityHeaders(response, nonce, pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|css|js|mp4|webm|mkv)$).*)",
  ],
};
