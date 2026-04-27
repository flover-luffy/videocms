import type { NextRequest } from "next/server";

const BEARER_TOKEN_PATTERN =
  /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i;

export function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return null;

  const match = BEARER_TOKEN_PATTERN.exec(authorization.trim());
  return match?.[1] ?? null;
}

export function getRequestAuthToken(request: NextRequest): string | null {
  return request.cookies.get("access_token")?.value ?? extractBearerToken(request);
}
