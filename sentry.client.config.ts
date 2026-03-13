import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://18edceb3912f49408e096f5e731fe71b@app.glitchtip.com/21038",
  tracesSampleRate: 1.0,
  debug: false, // 关闭客户端调试日志暴露
  enabled: true, // 强制启用，避免被 Dev 环境默认禁用
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  // 启用隧道以绕过广告拦截器
  tunnel: "/api/glitchtip-tunnel",
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
