import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./errors";
import { API_TIMEOUT_CONFIG } from "@/config";
import logger from "./logger";

/**
 * API路由处理器类型定义
 * @template T - 路由上下文类型
 */
type ApiHandler<T = unknown> = (
  req: NextRequest,
  ctx: T,
) => Promise<NextResponse | Response>;

/**
 * API处理器选项
 */
interface ApiHandlerOptions {
  /** 超时时间（毫秒），默认使用配置值 */
  timeout?: number;
  /** 请求体最大大小（字节），默认5MB */
  maxBodySize?: number;
}

/** 默认最大请求体大小：5MB */
const DEFAULT_MAX_BODY_SIZE = 5 * 1024 * 1024;

/** 写入操作的HTTP方法集合 */
const WRITE_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * 为Promise添加超时控制
 * @param promise - 原始Promise
 * @param timeoutMs - 超时时间（毫秒）
 * @param errorMessage - 超时错误消息
 * @returns 带超时的Promise
 */
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

/**
 * 检查请求体大小是否在限制范围内
 * @param req - Next.js请求对象
 * @param maxBodySize - 最大允许大小（字节）
 * @returns 是否在限制内
 */
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

  // 对于非写入方法，不检查body大小
  if (!WRITE_METHODS.has(req.method)) {
    return true;
  }

  // 流式读取body并计算大小
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

/**
 * API处理器包装函数
 * 提供统一的错误处理、超时控制和请求体大小验证
 *
 * @param handler - 实际的API处理函数
 * @param options - 可选配置项
 * @returns 包装后的处理器
 *
 * @example
 * export const GET = withApiHandler(async (req) => {
 *   const data = await fetchData();
 *   return NextResponse.json({ data });
 * });
 */
export function withApiHandler<T = unknown>(
  handler: ApiHandler<T>,
  options: ApiHandlerOptions = {},
): ApiHandler<T> {
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
        error instanceof Error && "cause" in error
          ? (error as Error & { cause: unknown }).cause
          : undefined;
      const code = typeof error === "object" && error !== null && "code" in error
        ? (error as { code: string }).code
        : undefined;

      // 记录错误日志
      if (process.env.NODE_ENV === "development") {
        logger.error("[API ERROR]", { message, stack, cause });
      } else {
        logger.error("[API ERROR]", message);
      }

      // AppError统一错误处理
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode },
        );
      }

      // Prisma错误处理
      if (code === "P2025") {
        return NextResponse.json(
          { error: "请求的资源不存在" },
          { status: 404 },
        );
      }

      // 默认错误响应
      const isDev = process.env.NODE_ENV !== "production";
      return NextResponse.json(
        { error: isDev ? message : "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}
