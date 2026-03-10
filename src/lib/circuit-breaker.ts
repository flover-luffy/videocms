/**
 * 熔断器模式实现
 * 用于保护外部服务调用，防止级联故障
 */

interface CircuitBreakerOptions {
    /** 失败阈值，超过此值后熔断器打开 */
    failureThreshold: number;
    /** 成功阈值，达到此值后熔断器关闭 */
    successThreshold: number;
    /** 超时时间（毫秒） */
    timeout: number;
    /** 半开状态等待时间（毫秒） */
    resetTimeout: number;
}

enum CircuitState {
    CLOSED = "CLOSED",     // 正常状态，允许请求通过
    OPEN = "OPEN",         // 熔断状态，拒绝所有请求
    HALF_OPEN = "HALF_OPEN" // 半开状态，允许部分请求通过以测试服务是否恢复
}

class CircuitBreakerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CircuitBreakerError";
    }
}

/**
 * 熔断器类
 */
class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount = 0;
    private successCount = 0;
    private nextAttempt = Date.now();
    private readonly options: CircuitBreakerOptions;

    constructor(options: Partial<CircuitBreakerOptions> = {}) {
        this.options = {
            failureThreshold: options.failureThreshold ?? 5,
            successThreshold: options.successThreshold ?? 2,
            timeout: options.timeout ?? 10000,
            resetTimeout: options.resetTimeout ?? 60000,
        };
    }

    /**
     * 获取当前状态
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            nextAttempt: this.nextAttempt,
        };
    }

    /**
     * 执行受保护的函数
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // 检查熔断器状态
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttempt) {
                throw new CircuitBreakerError(
                    `熔断器已打开，请在 ${Math.ceil((this.nextAttempt - Date.now()) / 1000)} 秒后重试`
                );
            }
            // 进入半开状态
            this.state = CircuitState.HALF_OPEN;
            this.successCount = 0;
        }

        try {
            // 直接执行函数，不添加额外超时（让调用方自己处理超时）
            const result = await fn();

            // 记录成功
            this.onSuccess();

            return result;
        } catch (error) {
            // 记录失败
            this.onFailure();
            throw error;
        }
    }

    /**
     * 处理成功情况
     */
    private onSuccess(): void {
        this.failureCount = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.options.successThreshold) {
                // 关闭熔断器
                this.state = CircuitState.CLOSED;
                this.successCount = 0;
            }
        }
    }

    /**
     * 处理失败情况
     */
    private onFailure(): void {
        this.failureCount++;

        if (
            this.state === CircuitState.HALF_OPEN ||
            this.failureCount >= this.options.failureThreshold
        ) {
            // 打开熔断器
            this.state = CircuitState.OPEN;
            this.nextAttempt = Date.now() + this.options.resetTimeout;
        }
    }

    /**
     * 手动重置熔断器
     */
    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttempt = Date.now();
    }
}

/**
 * 创建熔断器实例的工厂函数
 */
function createCircuitBreaker(
    options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
    return new CircuitBreaker(options);
}

/**
 * 全局熔断器实例（用于外部服务）
 */
export const tmdbCircuitBreaker = createCircuitBreaker({
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 10000,
    resetTimeout: 60000,
});

export const openlistCircuitBreaker = createCircuitBreaker({
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000,
    resetTimeout: 30000,
});
