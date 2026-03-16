
/**
 * Next.js Instrumentation 钩子 (v8+ 推荐)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. 初始化 OpenTelemetry (必须在最早的时机执行)
    // 根据用户提供的端点，如果环境变量没传，默认使用传入的参数
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://tracing-cn-guangzhou.arms.aliyuncs.com/adapt_a5dd86x7j5@521f2876e10700c_a5dd86x7j5@53df7ad2afe8301/api/otlp/traces";
    
    // 只有在存在端点时才启动追踪（避免本地开发如果不想要的话报错，虽然默认硬编码了用户指定的节点）
    try {
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
      
      const sdk = new NodeSDK({
        traceExporter: new OTLPTraceExporter({
          url: otlpEndpoint,
        }),
        instrumentations: [getNodeAutoInstrumentations()],
        serviceName: "videocms",
      });
      
      sdk.start();
      console.log("✅ OpenTelemetry 监控已启动，端点:", otlpEndpoint);
    } catch (err: unknown) {
      console.error("⚠️ OpenTelemetry 初始化失败", err);
    }

    // 2. 启动后台定时任务
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
