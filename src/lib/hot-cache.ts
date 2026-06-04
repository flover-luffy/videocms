/**
 * 热点数据缓存策略
 * 为频繁访问的数据添加缓存层
 */

import { cacheManager } from "./cache";
import { CACHE } from "./constants";

// 定义缓存数据类型
interface SeriesData {
  id: number;
  title: string;
  [key: string]: unknown;
}

interface CacheData {
  [key: string]: unknown;
}

// 热门剧集缓存（5分钟TTL）
export const popularSeriesCache = cacheManager.getCache<SeriesData[]>(
  "popular-series",
  100,
  CACHE.DEFAULT_TTL
);

// 推荐列表缓存（5分钟TTL）
export const recommendationsCache = cacheManager.getCache<SeriesData[]>(
  "recommendations",
  100,
  CACHE.DEFAULT_TTL
);

// 首页横幅缓存（10分钟TTL）
export const heroBannerCache = cacheManager.getCache<CacheData>(
  "hero-banner",
  10,
  10 * CACHE.DEFAULT_TTL
);

// 系列详情缓存（30分钟TTL）
export const seriesDetailCache = cacheManager.getCache<CacheData>(
  "series-detail",
  1000,
  6 * CACHE.DEFAULT_TTL
);

// 搜索结果缓存（2分钟TTL）
export const searchResultsCache = cacheManager.getCache<CacheData>(
  "search-results",
  500,
  2 * CACHE.DEFAULT_TTL / 5
);

/**
 * 缓存包装器 - 自动处理缓存逻辑
 */
export async function withCache<T extends object>(
  key: string,
  cacheName: ReturnType<typeof cacheManager.getCache<T>>,
  fetcher: () => Promise<T>
): Promise<T> {
  // 尝试从缓存获取
  const cached = await cacheName.get(key);
  if (cached) {
    return cached;
  }

  // 缓存未命中，执行查询
  const data = await fetcher();

  // 存入缓存
  await cacheName.set(key, data);

  return data;
}
