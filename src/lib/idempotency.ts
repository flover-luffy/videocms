import { NextRequest, NextResponse } from "next/server";
import { cacheManager } from "@/lib/cache";

interface IdempotencyResponse {
  headers: Record<string, string>;
  body: string;
  status: number;
}

const IDEMPOTENCY_CACHE_TTL = 24 * 60 * 60;

const idempotencyCache = cacheManager.getCache<IdempotencyResponse>(
  "idempotency",
  1000,
  IDEMPOTENCY_CACHE_TTL,
);

export async function enforceIdempotency(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const idempotencyKey = request.headers.get("idempotency-key");

  if (!idempotencyKey) {
    return NextResponse.json(
      {
        error: "Missing idempotency key",
        errorCode: "MISSING_IDEMPOTENCY_KEY",
        message: "POST/PUT/PATCH requests must include Idempotency-Key",
      },
      { status: 400 },
    );
  }

  if (!/^[a-z0-9\-]{8,}$/i.test(idempotencyKey)) {
    return NextResponse.json(
      {
        error: "Invalid idempotency key",
        errorCode: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key must be a valid UUID or identifier",
      },
      { status: 400 },
    );
  }

  const cacheKey = `idempotency:${idempotencyKey}`;
  const cachedResult = await idempotencyCache.get(cacheKey);

  if (cachedResult) {
    const response = new NextResponse(cachedResult.body, {
      status: cachedResult.status,
      headers: cachedResult.headers,
    });
    response.headers.set("x-idempotency-cache", "hit");
    return response;
  }

  const response = await handler();

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

  return response;
}
