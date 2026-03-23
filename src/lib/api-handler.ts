import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./errors";
import { API_TIMEOUT_CONFIG } from "@/config";

type ApiHandler<T = unknown> = (
  req: NextRequest,
  ctx: T,
) => Promise<NextResponse | Response>;

interface ApiHandlerOptions {
  timeout?: number;
  maxBodySize?: number;
}

const DEFAULT_MAX_BODY_SIZE = 5 * 1024 * 1024;
const WRITE_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = "请求超时",
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new AppError(errorMessage, 408)), timeoutMs),
    ),
  ]);
}

async function isRequestBodyWithinLimit(
  req: NextRequest,
  maxBodySize: number,
): Promise<boolean> {
  const contentLengthHeader = req.headers.get("content-length");
  const parsedContentLength =
    contentLengthHeader === null
      ? Number.NaN
      : Number.parseInt(contentLengthHeader, 10);
  const hasValidContentLength =
    Number.isFinite(parsedContentLength) && parsedContentLength >= 0;

  if (hasValidContentLength) {
    return parsedContentLength <= maxBodySize;
  }

  if (!WRITE_METHODS.has(req.method)) {
    return true;
  }

  const reader = req.clone().body?.getReader();
  if (!reader) {
    return true;
  }

  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return true;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBodySize) {
        return false;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function withApiHandler<T = unknown>(
  handler: ApiHandler<T>,
  options: ApiHandlerOptions = {},
) {
  const {
    timeout = API_TIMEOUT_CONFIG.DEFAULT,
    maxBodySize = DEFAULT_MAX_BODY_SIZE,
  } = options;

  return async (req: NextRequest, ctx: T) => {
    try {
      return await withTimeout(
        (async () => {
          const isWithinLimit = await isRequestBodyWithinLimit(
            req,
            maxBodySize,
          );
          if (!isWithinLimit) {
            return NextResponse.json(
              { error: "Payload Too Large: 请求体大小超过限制" },
              { status: 413 },
            );
          }

          return handler(req, ctx);
        })(),
        timeout,
        `请求超时（${timeout}ms）`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Internal Server Error";
      const stack = error instanceof Error ? error.stack : undefined;
      const cause =
        error instanceof Error
          ? (error as Error & { cause?: unknown }).cause
          : undefined;
      const code = (error as { code?: string })?.code;

      if (process.env.NODE_ENV === "development") {
        console.error("[API ERROR]", { message, stack, cause });
      } else {
        console.error("[API ERROR]", message);
      }

      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode },
        );
      }

      if (code === "P2025") {
        return NextResponse.json(
          { error: "请求的资源不存在" },
          { status: 404 },
        );
      }

      const isDev = process.env.NODE_ENV !== "production";
      return NextResponse.json(
        { error: isDev ? message : "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}
