/**
 * Sentry Edge Runtime 配置
 * 捕获 Next.js Middleware 和 Edge Functions 中的错误
 */
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV,

        // Edge 环境下的性能采样
        tracesSampleRate: 0.1,

        // 调试模式（仅开发环境开启）
        debug: process.env.NODE_ENV === "development",
    });
}
