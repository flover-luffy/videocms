/**
 * Sentry 服务端配置
 * 捕获 Node.js 运行时的错误和未处理异常
 */
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV,

        // 性能追踪采样率
        tracesSampleRate: 0.1,

        // 调试模式（仅开发环境开启）
        debug: process.env.NODE_ENV === "development",
    });
}
