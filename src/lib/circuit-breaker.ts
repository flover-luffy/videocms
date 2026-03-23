/**
 * 熔断器模式实现
 * 用于保护外部服务调用，防止级联故障
 * 支持监听事件、详细统计、自定义恢复策略等功能
 */

export interface CircuitBreakerOptions {
  /** 失败阈值，超过此值后熔断器打开 */
  failureThreshold?: number;
  /** 成功阈值，达到此值后熔断器关闭 */
  successThreshold?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 半开状态等待时间（毫秒） */
  resetTimeout?: number;
  /** 恢复策略：立即 | 线性 | 指数 */
  recoveryStrategy?: "immediate" | "linear" | "exponential";
  /** 名称（用于日志和监控） */
  name?: string;
  /** 监听器回调 */
  onStateChange?: (newState: CircuitState, oldState: CircuitState) => void;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
  onOpen?: () => void;
  onHalfOpen?: () => void;
  onClose?: () => void;
}

export enum CircuitState {
  CLOSED = "CLOSED", // 正常状态，允许请求通过
  OPEN = "OPEN", // 熔断状态，拒绝所有请求
  HALF_OPEN = "HALF_OPEN", // 半开状态，允许部分请求通过以测试服务是否恢复
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

/**
 * 熔断器统计信息
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  totalSuccess: number;
  totalFailure: number;
  nextAttempt: number;
  lastStateChange: number;
  uptime: number;
  stateOpenDuration?: number;
}

/**
 * 熔断器类
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();
  private readonly options: Required<CircuitBreakerOptions>;
  private totalRequests = 0;
  private totalSuccess = 0;
  private totalFailure = 0;
  private lastStateChange = Date.now();
  private stateOpenTime: number | null = null;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      timeout: options.timeout ?? 10000,
      resetTimeout: options.resetTimeout ?? 60000,
      recoveryStrategy: options.recoveryStrategy ?? "exponential",
      name: options.name ?? "CircuitBreaker",
      onStateChange: options.onStateChange ?? (() => {}),
      onSuccess: options.onSuccess ?? (() => {}),
      onFailure: options.onFailure ?? (() => {}),
      onOpen: options.onOpen ?? (() => {}),
      onHalfOpen: options.onHalfOpen ?? (() => {}),
      onClose: options.onClose ?? (() => {}),
    };
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取详详细的统计信息
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      totalSuccess: this.totalSuccess,
      totalFailure: this.totalFailure,
      nextAttempt: this.nextAttempt,
      lastStateChange: this.lastStateChange,
      uptime: Date.now() - this.lastStateChange,
      stateOpenDuration: this.stateOpenTime
        ? this.state === CircuitState.OPEN
          ? Date.now() - this.stateOpenTime
          : 0
        : undefined,
    };
  }

  /**
   * 执行受保护的函数
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // 检查熔断器状态
    if (this.state === CircuitState.OPEN) {
      const retryAfter = Math.max(0, this.nextAttempt - Date.now());
      if (retryAfter > 0) {
        throw new CircuitBreakerError(
          `[${this.options.name}] 熔断器已打开，请在 ${Math.ceil(retryAfter / 1000)} 秒后重试`,
          retryAfter,
        );
      }
      // 进入半开状态
      this._setState(CircuitState.HALF_OPEN);
      this.successCount = 0;
      this.options.onHalfOpen();
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            reject(new Error("Operation timeout"));
          }, this.options.timeout),
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 处理成功情况
   */
  private onSuccess(): void {
    this.totalSuccess++;
    this.failureCount = 0;
    this.options.onSuccess();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this._setState(CircuitState.CLOSED);
        this.successCount = 0;
        this.options.onClose();
      }
    }
  }

  /**
   * 处理失败情况
   */
  private onFailure(error: Error): void {
    this.totalFailure++;
    this.failureCount++;
    this.options.onFailure(error);

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.options.failureThreshold
    ) {
      this._setState(CircuitState.OPEN);
      this._scheduleRecovery();
      this.options.onOpen();
    }
  }

  /**
   * 根据恢复策略安排下一次重试
   */
  private _scheduleRecovery(): void {
    const strategy = this.options.recoveryStrategy;
    let delay = this.options.resetTimeout;

    if (strategy === "linear") {
      // 线性增长: resetTimeout, resetTimeout*2, resetTimeout*3 ...
      const attempts = Math.floor(
        (Date.now() - (this.stateOpenTime || Date.now())) /
          this.options.resetTimeout,
      );
      delay = this.options.resetTimeout * (attempts + 1);
    } else if (strategy === "exponential") {
      // 指数增长，但有上限 (防止过长延迟)
      const attempts = Math.floor(
        (Date.now() - (this.stateOpenTime || Date.now())) /
          this.options.resetTimeout,
      );
      delay = Math.min(
        this.options.resetTimeout * Math.pow(2, attempts),
        this.options.resetTimeout * 60, // 最多 1 小时
      );
    }

    this.nextAttempt = Date.now() + delay;
  }

  /**
   * 改变状态（内部方法）
   */
  private _setState(newState: CircuitState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === CircuitState.OPEN) {
      this.stateOpenTime = Date.now();
    } else if (newState === CircuitState.CLOSED) {
      this.stateOpenTime = null;
    }

    this.options.onStateChange(newState, oldState);

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[${this.options.name}] State changed: ${oldState} -> ${newState}`,
      );
    }
  }

  /**
   * 手动重置熔断器
   */
  reset(): void {
    this._setState(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * 获取健康检查状态
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * 获取通过率 (百分比)
   */
  getSuccessRate(): number {
    if (this.totalRequests === 0) return 100;
    return (this.totalSuccess / this.totalRequests) * 100;
  }
}

/**
 * 创建熔断器实例的工厂函数
 */
export function createCircuitBreaker(
  options?: CircuitBreakerOptions,
): CircuitBreaker {
  return new CircuitBreaker(options);
}

/**
 * 全局熔断器管理器
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  register(name: string, breaker: CircuitBreaker): void {
    this.breakers.set(name, breaker);
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  getStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * 全局熔断器实例（用于外部服务）
 */
export const tmdbCircuitBreaker = createCircuitBreaker({
  name: "tmdb",
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 10000,
  resetTimeout: 60000,
});

export const openlistCircuitBreaker = createCircuitBreaker({
  name: "openlist",
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 15000,
  resetTimeout: 30000,
});

circuitBreakerRegistry.register("tmdb", tmdbCircuitBreaker);
circuitBreakerRegistry.register("openlist", openlistCircuitBreaker);
