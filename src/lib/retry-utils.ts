/**
 * 重试工具函数
 */

/**
 * 重试配置
 */
interface RetryConfig {
  maxRetries?: number; // 最大重试次数
  baseDelay?: number; // 基础延迟（毫秒）
  maxDelay?: number; // 最大延迟（毫秒）
  backoffMultiplier?: number; // 退避倍数
}

/**
 * 执行带重试的异步操作
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
  } = config;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxRetries) {
        break;
      }

      // 计算延迟时间（指数退避）
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay,
      );

      // 添加随机抖动（±10%）
      const jitter = delay * 0.1 * (Math.random() * 2 - 1);
      const finalDelay = Math.max(0, delay + jitter);

      console.warn(
        `[Retry] 尝试 ${attempt + 1}/${maxRetries} 失败，${Math.round(finalDelay)}ms 后重试...`,
        lastError.message,
      );

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError || new Error("操作失败");
}
