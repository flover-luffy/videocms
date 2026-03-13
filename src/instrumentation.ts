
import * as Sentry from "@sentry/nextjs";

/**
 * Next.js Instrumentation 钩子 (v8+ 推荐)
 * 用于在服务器和边缘端启动时自动初始化 Sentry
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    
    // 启动后台定时任务
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
 
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
