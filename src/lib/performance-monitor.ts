/**
 * 性能监控模块
 * 用于收集和分析应用性能指标（响应时间、吞吐量、错误率等）
 */

export interface PerformanceMetrics {
  /** 端点路径 */
  endpoint: string;
  /** HTTP 方法 */
  method: string;
  /** 响应时间（毫秒） */
  duration: number;
  /** HTTP 状态码 */
  statusCode: number;
  /** 请求时间戳 */
  timestamp: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如有） */
  error?: string;
  /** 额外数据 */
  metadata?: Record<string, string | number | boolean>;
}

export interface AggregatedMetrics {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successCount: number;
  /** 失败请求数 */
  errorCount: number;
  /** 平均响应时间（毫秒） */
  avgDuration: number;
  /** 最小响应时间 */
  minDuration: number;
  /** 最大响应时间 */
  maxDuration: number;
  /** 中位数响应时间 */
  p50Duration: number;
  /** 95 百分位数响应时间 */
  p95Duration: number;
  /** 99 百分位数响应时间 */
  p99Duration: number;
  /** 成功率 */
  successRate: number;
  /** 吞吐量（请求/秒） */
  throughput: number;
}

/**
 * 性能监控收集器
 */
class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics: number = 10000; // 保留最近 10000 条记录
  private startTime: number = Date.now();

  /**
   * 记录一次请求的性能指标
   */
  recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);

    // 防止内存溢出，只保留最近的记录
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * 获取特定端点的聚合指标
   */
  getEndpointMetrics(
    endpointPattern?: string | RegExp,
  ): AggregatedMetrics | null {
    let filtered = this.metrics;

    if (endpointPattern) {
      if (typeof endpointPattern === "string") {
        const pattern = new RegExp(`^${endpointPattern.replace(/\*/g, ".*")}$`);
        filtered = this.metrics.filter((m) => pattern.test(m.endpoint));
      } else {
        filtered = this.metrics.filter((m) => endpointPattern.test(m.endpoint));
      }
    }

    if (filtered.length === 0) return null;

    return this._aggregateMetrics(filtered);
  }

  /**
   * 获取全局聚合指标
   */
  getGlobalMetrics(): AggregatedMetrics {
    return this._aggregateMetrics(this.metrics);
  }

  /**
   * 获取端点列表及其指标
   */
  getEndpointsList(): Record<string, AggregatedMetrics> {
    const grouped = new Map<string, PerformanceMetrics[]>();

    for (const metric of this.metrics) {
      if (!grouped.has(metric.endpoint)) {
        grouped.set(metric.endpoint, []);
      }
      grouped.get(metric.endpoint)!.push(metric);
    }

    const result: Record<string, AggregatedMetrics> = {};
    for (const [endpoint, metrics] of grouped.entries()) {
      result[endpoint] = this._aggregateMetrics(metrics);
    }

    return result;
  }

  /**
   * 获取最慢的 N 个请求
   */
  getSlowestRequests(limit: number = 10): PerformanceMetrics[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * 获取最近的错误
   */
  getRecentErrors(limit: number = 20): PerformanceMetrics[] {
    return this.metrics
      .filter((m) => !m.success)
      .slice(-limit)
      .reverse();
  }

  /**
   * 获取时间段内的性能趋势
   */
  getTrendMetrics(
    intervalSeconds: number = 60,
  ): Record<string, AggregatedMetrics> {
    const trends: Record<number, PerformanceMetrics[]> = {};
    const now = Date.now();

    for (const metric of this.metrics) {
      const interval = Math.floor(
        (now - metric.timestamp) / (intervalSeconds * 1000),
      );
      if (!trends[interval]) {
        trends[interval] = [];
      }
      trends[interval].push(metric);
    }

    const result: Record<string, AggregatedMetrics> = {};
    for (const [interval, metrics] of Object.entries(trends)) {
      result[interval] = this._aggregateMetrics(metrics);
    }

    return result;
  }

  /**
   * 清空所有指标
   */
  clear() {
    this.metrics = [];
  }

  /**
   * 获取当前收集的指标数量
   */
  getMetricsCount(): number {
    return this.metrics.length;
  }

  /**
   * 聚合指标的内部实现
   */
  private _aggregateMetrics(metrics: PerformanceMetrics[]): AggregatedMetrics {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        successRate: 0,
        throughput: 0,
      };
    }

    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const successCount = metrics.filter((m) => m.success).length;
    const errorCount = metrics.length - successCount;
    const avgDuration = durations.reduce((a, b) => a + b, 0) / metrics.length;

    // 计算百分位数
    const getPercentile = (arr: number[], p: number) => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    // 计算时间跨度（假设按时间排序）
    const timeSpan =
      (metrics[metrics.length - 1].timestamp - metrics[0].timestamp) / 1000;
    const throughput = timeSpan > 0 ? metrics.length / timeSpan : 0;

    return {
      totalRequests: metrics.length,
      successCount,
      errorCount,
      avgDuration,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p50Duration: getPercentile(durations, 50),
      p95Duration: getPercentile(durations, 95),
      p99Duration: getPercentile(durations, 99),
      successRate: (successCount / metrics.length) * 100,
      throughput,
    };
  }
}

// 全局监控实例
export const performanceMonitor = new PerformanceMonitor();

/**
 * 性能计时器装饰器
 * @example
 * @withTiming('/api/users')
 * async function getUsers(req: Request) { ... }
 */
export function withTiming(
  endpointName: string,
  metadata?: Record<string, string | number | boolean>,
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const startTime = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        performanceMonitor.recordMetric({
          endpoint: endpointName,
          method: "ASYNC",
          duration,
          statusCode: 200,
          timestamp: Date.now(),
          success: true,
          metadata,
        });

        return result;
      } catch (err) {
        const duration = Date.now() - startTime;
        performanceMonitor.recordMetric({
          endpoint: endpointName,
          method: "ASYNC",
          duration,
          statusCode: 500,
          timestamp: Date.now(),
          success: false,
          error: err instanceof Error ? err.message : String(err),
          metadata,
        });
        throw err;
      }
    };

    return descriptor;
  };
}

/**
 * 分析性能基线（用于对比）
 */
export function analyzeBaseline(
  currentMetrics: AggregatedMetrics,
  baselineMetrics?: AggregatedMetrics,
) {
  if (!baselineMetrics) {
    return {
      currentMetrics,
      improvement: null,
      degradation: null,
    };
  }

  const durationDiff = currentMetrics.avgDuration - baselineMetrics.avgDuration;
  const durationChangePercent = (
    (durationDiff / baselineMetrics.avgDuration) *
    100
  ).toFixed(2);

  const throughputDiff = currentMetrics.throughput - baselineMetrics.throughput;
  const throughputChangePercent = (
    (throughputDiff / baselineMetrics.throughput) *
    100
  ).toFixed(2);

  const successRateDiff =
    currentMetrics.successRate - baselineMetrics.successRate;

  return {
    currentMetrics,
    baselineMetrics,
    duration: {
      current: currentMetrics.avgDuration,
      baseline: baselineMetrics.avgDuration,
      difference: durationDiff,
      percentageChange: `${durationChangePercent}%`,
      improved: durationDiff < 0,
    },
    throughput: {
      current: currentMetrics.throughput,
      baseline: baselineMetrics.throughput,
      difference: throughputDiff,
      percentageChange: `${throughputChangePercent}%`,
      improved: throughputDiff > 0,
    },
    successRate: {
      current: currentMetrics.successRate,
      baseline: baselineMetrics.successRate,
      difference: successRateDiff,
      improved: successRateDiff > 0,
    },
  };
}

/**
 * 生成性能报告
 */
export function generatePerformanceReport(): {
  timestamp: number;
  global: AggregatedMetrics;
  endpoints: Record<string, AggregatedMetrics>;
  slowest: PerformanceMetrics[];
  recentErrors: PerformanceMetrics[];
} {
  return {
    timestamp: Date.now(),
    global: performanceMonitor.getGlobalMetrics(),
    endpoints: performanceMonitor.getEndpointsList(),
    slowest: performanceMonitor.getSlowestRequests(10),
    recentErrors: performanceMonitor.getRecentErrors(20),
  };
}
