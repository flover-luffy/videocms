import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./errors";
import { API_TIMEOUT_CONFIG } from "@/config";

/** 
 * 定义统一的 API 处理函数类型 
 * 包含对 Next.js App Router Params 的支持
 */
type ApiHandler<T = unknown> = (
    req: NextRequest,
    ctx: T
) => Promise<NextResponse | Response>;

/**
 * API 处理器选项
 */
interface ApiHandlerOptions {
    /** 请求超时时间（毫秒），默认 30 秒 */
    timeout?: number;
    /** 最大请求体大小（字节），默认 5MB */
    maxBodySize?: number;
}

const DEFAULT_MAX_BODY_SIZE = 5 * 1024 * 1024; // 默认限制 5MB

/**
 * 创建带超时的 Promise
 */
function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = "请求超时"
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new AppError(errorMessage, 408)), timeoutMs)
        ),
    ]);
}

export function withApiHandler<T = unknown>(
    handler: ApiHandler<T>,
    options: ApiHandlerOptions = {}
) {
    const {
        timeout = API_TIMEOUT_CONFIG.DEFAULT,
        maxBodySize = DEFAULT_MAX_BODY_SIZE,
    } = options;

    return async (req: NextRequest, ctx: T) => {
        try {
            // 基础安全性校验：请求体大小限制
            const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
            if (contentLength > maxBodySize) {
                return NextResponse.json(
                    { error: "Payload Too Large: 请求体大小超过限制" },
                    { status: 413 }
                );
            }

            // 应用超时控制
            return await withTimeout(
                handler(req, ctx),
                timeout,
                `请求超时（${timeout}ms）`
            );
        } catch (error: any) {
            console.error("[API ERROR DEPTH]", {
                message: error.message,
                stack: error.stack,
                cause: error.cause,
                details: error
            });

            // 1. 优先处理类型化业务错误
            if (error instanceof AppError) {
                return NextResponse.json({ error: error.message }, { status: error.statusCode });
            }

            // 2. Prisma 记录不存在
            if (error?.code === 'P2025') {
                return NextResponse.json({ error: "请求的资源不存在" }, { status: 404 });
            }

            // 3. 开发环境返回具体消息
            const isDev = process.env.NODE_ENV !== "production";
            return NextResponse.json({ 
                error: isDev ? (error.message || "Internal Server Error") : "Internal Server Error",
                stack: isDev ? error.stack : undefined
            }, { status: 500 });
        }
    };
}
