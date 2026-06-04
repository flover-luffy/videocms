import logger from "@/lib/logger";
/**
 * 全局统一缓存服务
 * 支持双轨运行：
 * 1. 存在 REDIS_URL 环境变量时，自动使用分布式的 Redis 服务
 * 2. 否则，平滑回退至单机内存 LRUCache
 */
import { LRUCache } from "lru-cache";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";

// 缓存接口定义，确保两种实现对外暴露相同的 API
export interface ICache<T extends object> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): Promise<number>;
  getOrSet(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T>;
  getOrSetWithFallback(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T | null>;
}

// 同步缓存接口 (仅适用于 MemoryCache)
export interface ISyncCache<T extends object> {
  getSync(key: string): T | null;
  setSync(key: string, value: T, ttlSeconds?: number): void;
  deleteSync(key: string): boolean;
}

// ============== 内存实现 (LRUCache) ==============
class MemoryCache<T extends object> implements ICache<T>, ISyncCache<T> {
  private cache: LRUCache<string, T>;
  private readonly defaultTTLMs: number;

  constructor(maxSize: number = 1000, defaultTTLSeconds: number = 300) {
    this.defaultTTLMs = defaultTTLSeconds * 1000;
    this.cache = new LRUCache<string, T>({
      max: maxSize,
      ttl: this.defaultTTLMs,
      allowStale: true,
    });
  }

  // ========== 同步 API (用于性能关键路径) ==========
  getSync(key: string): T | null {
    const value = this.cache.get(key);
    return value === undefined ? null : value;
  }

  setSync(key: string, value: T, ttlSeconds?: number): void {
    const options =
      ttlSeconds !== undefined ? { ttl: ttlSeconds * 1000 } : undefined;
    this.cache.set(key, value, options);
  }

  deleteSync(key: string): boolean {
    return this.cache.delete(key);
  }

  // ========== 异步 API (兼容现有接口) ==========
  async get(key: string): Promise<T | null> {
    return this.getSync(key);
  }

  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.setSync(key, value, ttlSeconds);
  }

  async delete(key: string): Promise<boolean> {
    return this.deleteSync(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async getOrSet(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = this.getSync(key);
    if (cached !== null) return cached;

    const value = await fn();
    this.setSync(key, value, ttlSeconds);
    return value;
  }

  async getOrSetWithFallback(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T | null> {
    const cached = this.getSync(key);
    if (cached !== null) return cached;

    try {
      const value = await fn();
      this.setSync(key, value, ttlSeconds);
      return value;
    } catch (error) {
      const staleValue = this.cache.get(key, { allowStale: true });
      if (staleValue !== undefined) {
        console.warn(`[Cache:Memory] 上游请求失败，使用陈旧缓存兜底: ${key}`);
        return staleValue as T;
      }
      console.error(`[Cache:Memory] 上游请求失败且无缓存可兜底: ${key}`, error);
      return null;
    }
  }
}

// ============== Redis 实现 ==============

const isBuildTime =
  process.env.npm_lifecycle_event === "build" ||
  process.env.NEXT_PHASE === "phase-production-build";

const shouldUseRedis =
  !isBuildTime &&
  process.env.NODE_ENV !== "test" &&
  Boolean(process.env.REDIS_URL);

const globalForRedis = globalThis as unknown as {
  redisClient: Redis | undefined;
  memoryLocks: Map<string, { owner: string; expiresAt: number }> | undefined;
};

let redisClient: Redis | null = globalForRedis.redisClient || null;

if (!redisClient && shouldUseRedis && process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    showFriendlyErrorStack: process.env.NODE_ENV !== "production",
    // Docker 容器启动时 DNS 可能尚未就绪，配置渐进式延迟重连策略
    retryStrategy(times: number) {
      if (times > 20) {
        console.error("🔴 Redis 重连次数超限，放弃连接");
        return null; // 停止重试
      }
      // 渐进延迟：100ms, 200ms, 400ms... 最高 3 秒
      const delay = Math.min(times * 100, 3000);
      console.warn(`⏳ Redis 第 ${times} 次重连，${delay}ms 后重试...`);
      return delay;
    },
    // DNS 解析失败时也触发重连
    reconnectOnError(err: Error) {
      const targetErrors = ["ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  redisClient.on("error", (err) => {
    // 仅在非重试场景下输出，避免日志风暴
    if (!err.message.includes("EAI_AGAIN")) {
      console.error("🔴 Redis 发生异常: ", err);
    }
  });

  redisClient.on("connect", () => {
    logger.info("✅ Redis 连接成功");
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redisClient = redisClient;
  }
}

class RedisCache<T extends object> implements ICache<T> {
  private readonly defaultTTLSeconds: number;
  private readonly prefix: string;
  private client: Redis;

  constructor(
    client: Redis,
    namespace: string,
    defaultTTLSeconds: number = 300,
  ) {
    this.client = client;
    this.prefix = `videocms:cache:${namespace}:`;
    this.defaultTTLSeconds = defaultTTLSeconds;
  }

  private getKey(key: string) {
    return `${this.prefix}${key}`;
  }

  private async scanNamespace(
    onBatch?: (keys: string[]) => Promise<void>,
  ): Promise<number> {
    let cursor = "0";
    let totalKeys = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        "MATCH",
        `${this.prefix}*`,
        "COUNT",
        100,
      );

      cursor = nextCursor;
      totalKeys += keys.length;

      if (onBatch && keys.length > 0) {
        await onBatch(keys);
      }
    } while (cursor !== "0");

    return totalKeys;
  }

  async get(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(this.getKey(key));
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error(`[Cache:Redis] get 失败: ${key}`, err);
      return null;
    }
  }

  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds !== undefined ? ttlSeconds : this.defaultTTLSeconds;
    try {
      await this.client.set(this.getKey(key), JSON.stringify(value), "EX", ttl);
      // Stale副本设置为主键TTL的3倍，防止内存无限增长
      const staleTTL = ttl * 3;
      await this.client.set(`${this.getKey(key)}:stale`, JSON.stringify(value), "EX", staleTTL);
    } catch (err) {
      console.error(`[Cache:Redis] set 失败: ${key}`, err);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const count = await this.client.del(this.getKey(key));
      await this.client.del(`${this.getKey(key)}:stale`);
      return count > 0;
    } catch (err) {
      console.error(`[Cache:Redis] delete 失败: ${key}`, err);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.scanNamespace(async (keys) => {
        await this.client.del(...keys);
      });
    } catch (err) {
      console.error(`[Cache:Redis] clear 失败`, err);
    }
  }

  async size(): Promise<number> {
    // 近似计算，实际需要更复杂逻辑或放弃该功能
    try {
      let entries = 0;

      await this.scanNamespace(async (keys) => {
        entries += keys.filter((key) => !key.endsWith(":stale")).length;
      });

      return entries;
    } catch (err) {
      console.error(`[Cache:Redis] size failed`, err);
      return 0;
    }
  }

  async getOrSet(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) return cached;

    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async getOrSetWithFallback(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T | null> {
    const cached = await this.get(key);
    if (cached !== null) return cached;

    try {
      const value = await fn();
      await this.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      try {
        const staleData = await this.client.get(`${this.getKey(key)}:stale`);
        if (staleData) {
          console.warn(`[Cache:Redis] 上游请求失败，使用陈旧缓存兜底: ${key}`);
          return JSON.parse(staleData) as T;
        }
      } catch (err) {
        console.error("[Cache:Redis] 兜底获取失败", err);
      }

      console.error(`[Cache:Redis] 上游请求失败且无缓存可兜底: ${key}`, error);
      return null;
    }
  }
}

// ============== 路由管理器 ==============
class CacheManager {
  private caches: Map<string, ICache<object>>;

  constructor() {
    this.caches = new Map();
  }

  /** 获取或创建命名缓存实例，自动决定使用 redis 还是 memory */
  getCache<T extends object>(
    name: string,
    maxSize: number = 1000,
    defaultTTLSeconds: number = 300,
  ): ICache<T> {
    if (!this.caches.has(name)) {
      let cacheInstance: ICache<object>;
      if (redisClient) {
        cacheInstance = new RedisCache<object>(
          redisClient,
          name,
          defaultTTLSeconds,
        );
      } else {
        cacheInstance = new MemoryCache<object>(maxSize, defaultTTLSeconds);
      }
      this.caches.set(name, cacheInstance);
    }
    return this.caches.get(name) as unknown as ICache<T>;
  }

  async clearAll(): Promise<void> {
    for (const cache of this.caches.values()) {
      await cache.clear();
    }
  }

  async getStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = await cache.size();
    }
    return stats;
  }
}

// 全局缓存管理器实例
export const cacheManager = new CacheManager();

const memoryLocks = globalForRedis.memoryLocks || new Map<string, { owner: string; expiresAt: number }>();
if (process.env.NODE_ENV !== "production") {
  globalForRedis.memoryLocks = memoryLocks;
}

export async function withDistributedLock<T>(
  name: string,
  ttlSeconds: number,
  task: () => Promise<T>,
): Promise<T | null> {
  const key = `videocms:lock:${name}`;
  const owner = randomUUID();

  if (redisClient) {
    const acquired = await redisClient.set(key, owner, "EX", ttlSeconds, "NX");
    if (acquired !== "OK") {
      return null;
    }

    try {
      return await task();
    } finally {
      await redisClient.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        key,
        owner,
      );
    }
  }

  const now = Date.now();
  const existing = memoryLocks.get(key);
  if (existing && existing.expiresAt > now) {
    return null;
  }

  memoryLocks.set(key, { owner, expiresAt: now + ttlSeconds * 1000 });
  try {
    return await task();
  } finally {
    const current = memoryLocks.get(key);
    if (current?.owner === owner) {
      memoryLocks.delete(key);
    }
  }
}

// 预定义的缓存实例 (Redis由于没有 maxSize，该参数会被忽略)
export const tmdbMetadataCache = cacheManager.getCache<object>(
  "tmdbMetadata",
  1000,
  3600,
); // 1 小时
export const searchCache = cacheManager.getCache<object>("search", 200, 300); // 5 分钟

// 类型断言：支持同步操作（用于 MemoryCache）
// ============== 速率限制缓存（单体部署，使用内存） ==============
// 用于 send-code 路由的时间戳缓存
type TimestampRecord = { ts: number }; // 包装为对象，满足 ICache<T extends object> 的要求
const sendCodeCacheInstance = cacheManager.getCache<TimestampRecord>(
  "send-code-limit",
  10000,
  60,
);
export const sendCodeCache = sendCodeCacheInstance;

// ============== 诊断和监控接口 ==============
function redactConnectionString(value: string | undefined): string {
  if (!value) return "未配置";

  try {
    const parsed = new URL(value);
    if (parsed.password) parsed.password = "***";
    if (parsed.username) parsed.username = "***";
    return parsed.toString();
  } catch {
    return "[redacted]";
  }
}

/**
 * 获取缓存系统诊断信息
 */
export async function getCacheDiagnostics() {
  return {
    redisConfigured: shouldUseRedis,
    redisUrl: redactConnectionString(process.env.REDIS_URL),
    redisConnected: redisClient ? "是" : "否",
    cacheType: redisClient ? "RedisCache" : "MemoryCache",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Redis 健康检查
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  message: string;
}> {
  if (!redisClient) {
    return {
      healthy: false,
      message: "Redis 未配置",
    };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;

    return {
      healthy: true,
      message: `Redis 连接正常 (延迟: ${latency}ms)`,
    };
  } catch (error) {
    console.error("[Redis Health Check] 失败:", error);
    return {
      healthy: false,
      message: `Redis 连接失败: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

/**
 * 检查 Redis 连接状态（仅当 Redis 启用时）
 */
export async function checkRedisConnection(): Promise<boolean> {
  if (!redisClient) return false;
  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
}
