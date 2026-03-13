
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Sentry 客户端初始化组件
 * 强制在客户端环境中挂载监控逻辑
 */
export default function SentryInitializer() {
  useEffect(() => {
    if (!Sentry.isInitialized()) {
        Sentry.init({
            dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://18edceb3912f49408e096f5e731fe71b@app.glitchtip.com/21038",
            tracesSampleRate: 1.0,
            enabled: true,
            tunnel: "/api/glitchtip-tunnel",
            replaysOnErrorSampleRate: 1.0,
            replaysSessionSampleRate: 0.1,
            integrations: [
                Sentry.replayIntegration({
                    maskAllText: true,
                    blockAllMedia: true,
                }),
            ],
        });
    }
  }, []);

  return null;
}
