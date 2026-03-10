/**
 * 内存缓存实现
 * 基于 npm lru-cache 包封装，统一项目中唯一的 LRU 实现
 */
import { LRUCache } from "lru-cache";

/**
 * 应用缓存封装
 * 在 npm lru-cache 基础上提供与原接口兼容的 API
 */
export class AppCache<T> {
    private cache: LRUCache<string, any>;
    private readonly defaultTTLMs: number;

    constructor(maxSize: number = 1000, defaultTTLSeconds: number = 300) {
        this.defaultTTLMs = defaultTTLSeconds * 1000;
        this.cache = new LRUCache<string, any>({
            max: maxSize,
            ttl: this.defaultTTLMs,
            // 允许获取过期条目（用于 Stale-While-Error 兜底）
            allowStale: true,
        });
    }

    /** 获取缓存值，未命中或过期返回 null */
    get(key: string): T | null {
        const value = this.cache.get(key);
        return value === undefined ? null : value;
    }

    /** 设置缓存值，ttl 单位为秒 */
    set(key: string, value: T, ttlSeconds?: number): void {
        const options = ttlSeconds !== undefined
            ? { ttl: ttlSeconds * 1000 }
            : undefined;
        this.cache.set(key, value, options);
    }

    /** 删除缓存值 */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /** 清空缓存 */
    clear(): void {
        this.cache.clear();
    }

    /** 获取缓存大小 */
    size(): number {
        return this.cache.size;
    }

    /** 获取或设置缓存（如果不存在则执行异步函数填充） */
    async getOrSet(
        key: string,
        fn: () => Promise<T>,
        ttlSeconds?: number,
    ): Promise<T> {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const value = await fn();
        this.set(key, value, ttlSeconds);
        return value;
    }

    /**
     * 获取或设置缓存，带上游失败兜底（Stale-While-Error）
     * 正常情况下与 getOrSet 行为一致；
     * 当 fn 抛出异常时，尝试返回过期的陈旧缓存值，避免页面白屏。
     */
    async getOrSetWithFallback(
        key: string,
        fn: () => Promise<T>,
        ttlSeconds?: number,
    ): Promise<T | null> {
        // 优先返回新鲜缓存
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        try {
            const value = await fn();
            this.set(key, value, ttlSeconds);
            return value;
        } catch (error) {
            // 上游失败：尝试返回过期的陈旧缓存（allowStale: true 使 LRU 保留过期条目）
            const staleValue = this.cache.get(key, { allowStale: true });
            if (staleValue !== undefined) {
                console.warn(`[Cache] 上游请求失败，使用陈旧缓存兜底: ${key}`);
                return staleValue as T;
            }

            // 既无缓存也无上游数据，打印错误并返回 null
            console.error(`[Cache] 上游请求失败且无缓存可兜底: ${key}`, error);
            return null;
        }
    }
}

/**
 * 缓存管理器
 * 集中管理所有命名缓存实例
 */
class CacheManager {
    private caches: Map<string, AppCache<any>>;

    constructor() {
        this.caches = new Map();
    }

    /** 获取或创建命名缓存实例 */
    getCache<T>(name: string, maxSize?: number, defaultTTLSeconds?: number): AppCache<T> {
        if (!this.caches.has(name)) {
            this.caches.set(name, new AppCache<T>(maxSize, defaultTTLSeconds) as AppCache<any>);
        }
        return this.caches.get(name) as AppCache<T>;
    }

    /** 清空所有缓存 */
    clearAll(): void {
        for (const cache of this.caches.values()) {
            cache.clear();
        }
    }

    /** 获取各缓存的条目数统计 */
    getStats(): Record<string, number> {
        const stats: Record<string, number> = {};
        for (const [name, cache] of this.caches.entries()) {
            stats[name] = cache.size();
        }
        return stats;
    }
}

// 全局缓存管理器实例
export const cacheManager = new CacheManager();

// 预定义的缓存实例
export const tmdbMetadataCache = cacheManager.getCache<unknown>('tmdbMetadata', 1000, 3600); // 1 小时
export const searchCache = cacheManager.getCache<unknown>('search', 200, 300); // 5 分钟
