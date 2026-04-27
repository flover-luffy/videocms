/**
 * Next.js Instrumentation 钩子 (v8+ 推荐)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. 初始化 Token 黑名单（从数据库加载忘记删除的 token）
    const { initializeTokenBlacklist } =
      await import("@/lib/auth/token-blacklist");
    await initializeTokenBlacklist();

    // 2. 初始化 OpenTelemetry (必须在较早的时机执行)
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    if (!otlpEndpoint) {
      console.info("OpenTelemetry 未配置，跳过追踪初始化。");
    } else {
      try {
        const { NodeSDK } = await import("@opentelemetry/sdk-node");
        const { OTLPTraceExporter } =
          await import("@opentelemetry/exporter-trace-otlp-http");
        const { getNodeAutoInstrumentations } =
          await import("@opentelemetry/auto-instrumentations-node");

        const sdk = new NodeSDK({
          traceExporter: new OTLPTraceExporter({
            url: otlpEndpoint,
          }),
          instrumentations: [getNodeAutoInstrumentations()],
          serviceName: "videocms",
        });

        sdk.start();
        console.info("✅ OpenTelemetry 监控已启动。");
      } catch (err: unknown) {
        console.error("⚠️ OpenTelemetry 初始化失败", err);
      }
    }

    // 3. 启动后台定时任务
    try {
      const { startScheduler } = await import("@/lib/scheduler");
      startScheduler();
      console.info("✅ 后台定时扫描任务已成功启动");
    } catch (schedulerErr) {
      console.error("❌ 后台定时任务启动失败:", schedulerErr);
    }
  }
}
