/**
 * 全局统一缓存服务
 * 支持双轨运行：
 * 1. 存在 REDIS_URL 环境变量时，自动使用分布式的 Redis 服务
 * 2. 否则，平滑回退至单机内存 LRUCache
 */
import { LRUCache } from "lru-cache";
import Redis from "ioredis";

// 缓存接口定义，确保两种实现对外暴露相同的 API
export interface ICache<T extends object> {
    get(key: string): Promise<T | null>;
    set(key: string, value: T, ttlSeconds?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    size(): Promise<number>;
    getOrSet(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T>;
    getOrSetWithFallback(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T | null>;
}

// ============== 内存实现 (LRUCache) ==============
class MemoryCache<T extends object> implements ICache<T> {
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

    async get(key: string): Promise<T | null> {
        const value = this.cache.get(key);
        return value === undefined ? null : value;
    }

    async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
        const options = ttlSeconds !== undefined ? { ttl: ttlSeconds * 1000 } : undefined;
        this.cache.set(key, value, options);
    }

    async delete(key: string): Promise<boolean> {
        return this.cache.delete(key);
    }

    async clear(): Promise<void> {
        this.cache.clear();
    }

    async size(): Promise<number> {
        return this.cache.size;
    }

    async getOrSet(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
        const cached = await this.get(key);
        if (cached !== null) return cached;

        const value = await fn();
        await this.set(key, value, ttlSeconds);
        return value;
    }

    async getOrSetWithFallback(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T | null> {
        const cached = await this.get(key);
        if (cached !== null) return cached;

        try {
            const value = await fn();
            await this.set(key, value, ttlSeconds);
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

let redisClient: Redis | null = null;
if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        showFriendlyErrorStack: process.env.NODE_ENV !== "production"
    });
    
    redisClient.on("error", (err) => {
        console.error("🔴 Redis 发生异常: ", err);
    });
}

class RedisCache<T extends object> implements ICache<T> {
    private readonly defaultTTLSeconds: number;
    private readonly prefix: string;
    private client: Redis;

    constructor(client: Redis, namespace: string, defaultTTLSeconds: number = 300) {
        this.client = client;
        this.prefix = `videocms:cache:${namespace}:`;
        this.defaultTTLSeconds = defaultTTLSeconds;
    }

    private getKey(key: string) {
        return `${this.prefix}${key}`;
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
            // 这里为了实现类似 LRU 的陈旧读取 (Stale fallback)，我们可以同时存一份不设过期时间的 shadow copy，
            // 但为了性能在这里直接复用基础的 EX 过期。真实的企业级架构可以引入独立的 stale namespace。
            await this.client.set(`${this.getKey(key)}:stale`, JSON.stringify(value));
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
            // 注意：生产环境使用 keys 是危险的，这只是简单的实现，应当使用 SCAN 或专门的 Redis 字典前缀清理策略
            if (process.env.NODE_ENV === "production") {
                console.warn("[Cache:Redis] 出于安全考虑，生产环境忽略 namespace clear()");
                return;
            }
            const keys = await this.client.keys(`${this.prefix}*`);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
        } catch (err) {
            console.error(`[Cache:Redis] clear 失败`, err);
        }
    }

    async size(): Promise<number> {
        // 近似计算，实际需要更复杂逻辑或放弃该功能
        return 0; 
    }

    async getOrSet(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
        const cached = await this.get(key);
        if (cached !== null) return cached;

        const value = await fn();
        await this.set(key, value, ttlSeconds);
        return value;
    }

    async getOrSetWithFallback(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T | null> {
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
    getCache<T extends object>(name: string, maxSize: number = 1000, defaultTTLSeconds: number = 300): ICache<T> {
        if (!this.caches.has(name)) {
            let cacheInstance: ICache<object>;
            if (redisClient) {
                cacheInstance = new RedisCache<object>(redisClient, name, defaultTTLSeconds);
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

// 预定义的缓存实例 (Redis由于没有 maxSize，该参数会被忽略)
export const tmdbMetadataCache = cacheManager.getCache<object>('tmdbMetadata', 1000, 3600); // 1 小时
export const searchCache = cacheManager.getCache<object>('search', 200, 300); // 5 分钟
