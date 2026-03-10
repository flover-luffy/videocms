/**
 * Sentry 客户端配置
 * 捕获浏览器端的 JavaScript 错误和性能数据
 */
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV,

        // 性能追踪：仅采样 10% 以节省配额
        tracesSampleRate: 0.1,

        // Session Replay：关闭常规录制，错误时录制 50%
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.5,

        // 过滤无意义的错误噪音
        ignoreErrors: [
            "ResizeObserver loop",
            "Non-Error promise rejection",
            "AbortError",
            "Load failed",
            "NetworkError",
        ],

        // 调试模式（仅开发环境开启）
        debug: process.env.NODE_ENV === "development",
    });
}
