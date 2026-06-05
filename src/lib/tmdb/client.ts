/**
 * TMDB 元数据客户端
 * 使用 TMDB v3 API 搜索和获取影视元数据（中文）
 */
import PQueue from "p-queue";
import { TMDB_CONFIG } from "@/config";
import { tmdbCircuitBreaker } from "@/lib/circuit-breaker";
import { cacheManager } from "@/lib/cache";

/** TMDB 元数据缓存（使用具名类型） */
type TmdbCacheEntry = TmdbMetadata;

const TMDB_BASE = TMDB_CONFIG.BASE_URL;
const TMDB_IMAGE_BASE = TMDB_CONFIG.IMAGE_BASE_URL;

/** 速率限制：从配置读取 */
const queue = new PQueue({
  concurrency: TMDB_CONFIG.RATE_LIMIT.concurrency,
  interval: TMDB_CONFIG.RATE_LIMIT.interval,
  intervalCap: TMDB_CONFIG.RATE_LIMIT.intervalCap,
});

/** 具名类型缓存实例 */
const tmdbMetadataCache = cacheManager.getCache<TmdbCacheEntry>(
  "tmdbMetadata",
  1000,
  3600,
); // 1 小时

interface TmdbSearchResult {
  id: number;
  title?: string; // 电影
  name?: string; // 剧集
  media_type: "movie" | "tv" | "person";
  vote_average: number;
  vote_count: number;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string; // 电影
  first_air_date?: string; // 剧集
  genre_ids: number[];
}

interface TmdbSearchResponse {
  results: TmdbSearchResult[];
  total_results: number;
}

interface TmdbMetadata {
  tmdbId: number;
  title: string;
  type: "movie" | "tv";
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  voteAverage: number;
  year: number | null;
  genres: string[];
  cast?: string[] | null; // 原 string 改为 string[]
  director?: string | null;
  tmdbData?: Record<string, unknown>; // TMDB API 原始响应对象
}

const GENRE_MAP_EN_ZH: Record<string, string> = {
  Action: "动作",
  Adventure: "冒险",
  Animation: "动画",
  Comedy: "喜剧",
  Crime: "犯罪",
  Documentary: "纪录片",
  Drama: "剧情",
  Family: "家庭",
  Fantasy: "奇幻",
  History: "历史",
  Horror: "恐怖",
  Music: "音乐",
  Mystery: "悬疑",
  Romance: "爱情",
  "Science Fiction": "科幻",
  "TV Movie": "电视电影",
  Thriller: "惊悚",
  War: "战争",
  Western: "西部",
  "Action & Adventure": "动作冒险",
  Kids: "儿童",
  News: "新闻",
  Reality: "真人秀",
  "Sci-Fi & Fantasy": "科幻奇幻",
  Soap: "肥皂剧",
  Talk: "脱口秀",
  "War & Politics": "战争政治",
};

/** 发起 TMDB GET 请求（带熔断器保护） */
async function tmdbGet<T>(path: string): Promise<T> {
  const apiKey = TMDB_CONFIG.API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY 未配置");

  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${apiKey}&language=zh-CN`;

  // 使用熔断器保护 TMDB 请求
  return tmdbCircuitBreaker.execute(async () => {
    const res = await fetch(url, { next: { revalidate: 3600 } }); // 缓存 1 小时

    if (!res.ok) {
      // 安全起见：错误消息中仅记录路径，不记录含 api_key 的完整 URL
      throw new Error(
        `TMDB API 错误 ${res.status}: ${TMDB_BASE}${path.split("?")[0]}`,
      );
    }
    return res.json() as Promise<T>;
  });
}

/**
 * 搜索影视元数据
 * @param title  影视名称（中文/英文均可）
 * @returns      匹配度最高的 TMDB 元数据，未找到则返回 null
 */
export async function searchTmdbMetadata(
  title: string,
): Promise<TmdbMetadata | null> {
  // 尝试从缓存获取
  const cacheKey = `tmdb:${title}`;
  const cached = await tmdbMetadataCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  return queue.add(async () => {
    try {
      // 第一步：先搜索（search/multi 不返回 credits）
      const searchResp = await tmdbGet<TmdbSearchResponse>(
        `/search/multi?query=${encodeURIComponent(title)}`,
      );

      const candidates = searchResp.results
        .filter((r) => r.media_type !== "person" && r.vote_count > 0)
        .sort((a, b) => b.vote_count - a.vote_count);

      if (candidates.length === 0) return null;

      const best = candidates[0];
      const isMovie = best.media_type === "movie";

      // 第二步：通过 ID 获取详情并带有 credits 附带信息
      const endpoint = isMovie ? `/movie/${best.id}` : `/tv/${best.id}`;
      const detailUrl = `${endpoint}?append_to_response=credits`;

      // 因为 tmdbGet 内部会拼接 url，我们需要传入拼好的 queryString 且它自带 api_key logic
      const detailResp = await tmdbGet<Record<string, unknown>>(detailUrl);

      const rawDate = isMovie
        ? detailResp.release_date
        : detailResp.first_air_date;
      const year =
        typeof rawDate === "string" ? new Date(rawDate).getFullYear() : null;

      // 提取导演/制片人 (Crew)
      let director = "";
      let cast: string[] = [];

      if (
        detailResp.credits &&
        typeof detailResp.credits === "object" &&
        detailResp.credits !== null
      ) {
        const credits = detailResp.credits as Record<string, unknown>;

        if (isMovie) {
          const dirObj = Array.isArray(credits.crew)
            ? credits.crew.find(
                (c: Record<string, unknown>) => c.job === "Director",
              )
            : null;
          if (dirObj) director = String(dirObj.name);
        } else {
          const creatorObj =
            (Array.isArray(detailResp.created_by)
              ? detailResp.created_by[0]
              : null) ||
            (Array.isArray(credits.crew)
              ? credits.crew.find(
                  (c: Record<string, unknown>) =>
                    c.job === "Executive Producer" || c.job === "Producer",
                )
              : null);
          if (creatorObj) director = String(creatorObj.name);
        }

        // 提取前 5 个主演 (Cast)
        if (Array.isArray(credits.cast)) {
          cast = credits.cast
            .slice(0, 5)
            .map((c: Record<string, unknown>) => String(c.name));
        }
      }

      const result = {
        tmdbId: detailResp.id,
        title: (isMovie ? detailResp.title : detailResp.name) ?? title,
        type: isMovie ? "movie" : "tv",
        posterUrl: detailResp.poster_path
          ? `${TMDB_IMAGE_BASE}${detailResp.poster_path}`
          : null,
        backdropUrl: detailResp.backdrop_path
          ? `https://image.tmdb.org/t/p/original${detailResp.backdrop_path}`
          : null,
        overview: detailResp.overview ?? "",
        voteAverage:
          typeof detailResp.vote_average === "number"
            ? Math.round(detailResp.vote_average * 10) / 10
            : 0,
        year: year !== null && !isNaN(year) ? year : null,
        genres: (Array.isArray(detailResp.genres) ? detailResp.genres : [])
          .map((g: { name: string }) => GENRE_MAP_EN_ZH[g.name] || g.name)
          .filter(Boolean),
        cast: cast.length > 0 ? cast : null,
        director: director || null,
        tmdbData: detailResp,
      } as TmdbMetadata;

      // 缓存结果（1 小时）
      await tmdbMetadataCache.set(cacheKey, result, 3600);

      return result;
    } catch (err) {
      console.error(`[TMDB] 搜索元数据失败: ${title}`, err);
      // 搜索失败时不缓存，避免第一次临时故障导致永久封锁
      return null;
    }
  }) as Promise<TmdbMetadata | null>;
}

/** TMDB 候选搜索结果（供前端展示） */
export interface TmdbCandidate {
  tmdbId: number;
  title: string;
  type: "movie" | "tv";
  posterUrl: string | null;
  year: number | null;
  overview: string;
  voteAverage: number;
}

/**
 * 搜索 TMDB 候选列表（不自动选择最佳）
 * 用于管理员手动校正时的候选展示
 */
export async function searchTmdbCandidates(
  query: string,
  limit: number = 10,
): Promise<TmdbCandidate[]> {
  return queue.add(async () => {
    try {
      const searchResp = await tmdbGet<TmdbSearchResponse>(
        `/search/multi?query=${encodeURIComponent(query)}`,
      );

      return searchResp.results
        .filter((r) => r.media_type !== "person")
        .slice(0, limit)
        .map((r) => {
          const isMovie = r.media_type === "movie";
          const rawDate = isMovie ? r.release_date : r.first_air_date;
          const year = rawDate ? new Date(rawDate).getFullYear() : null;

          return {
            tmdbId: r.id,
            title: (isMovie ? r.title : r.name) ?? "未知标题",
            type: isMovie ? ("movie" as const) : ("tv" as const),
            posterUrl: r.poster_path
              ? `${TMDB_IMAGE_BASE}${r.poster_path}`
              : null,
            year: year !== null && !isNaN(year) ? year : null,
            overview: r.overview ?? "",
            voteAverage: Math.round(r.vote_average * 10) / 10,
          };
        });
    } catch (err) {
      console.error(`[TMDB] 候选搜索失败: ${query}`, err);
      return [];
    }
  }) as Promise<TmdbCandidate[]>;
}

/**
 * 通过 TMDB ID 直接获取完整元数据
 * 用于管理员选定候选项后的精确绑定
 */
export async function fetchTmdbById(
  tmdbId: number,
  type: "movie" | "tv",
): Promise<TmdbMetadata | null> {
  return queue.add(async () => {
    try {
      const endpoint = type === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
      const detailResp = await tmdbGet<Record<string, unknown>>(
        `${endpoint}?append_to_response=credits`,
      );

      const isMovie = type === "movie";
      const rawDate = isMovie
        ? detailResp.release_date
        : detailResp.first_air_date;
      const year =
        typeof rawDate === "string" ? new Date(rawDate).getFullYear() : null;

      let director = "";
      let cast: string[] = [];

      if (
        detailResp.credits &&
        typeof detailResp.credits === "object" &&
        detailResp.credits !== null
      ) {
        const credits = detailResp.credits as Record<string, unknown>;

        if (isMovie) {
          const dirObj = Array.isArray(credits.crew)
            ? credits.crew.find(
                (c: Record<string, unknown>) => c.job === "Director",
              )
            : null;
          if (dirObj) director = String(dirObj.name);
        } else {
          const creatorObj =
            (Array.isArray(detailResp.created_by)
              ? detailResp.created_by[0]
              : null) ||
            (Array.isArray(credits.crew)
              ? credits.crew.find(
                  (c: Record<string, unknown>) =>
                    c.job === "Executive Producer" || c.job === "Producer",
                )
              : null);
          if (creatorObj) director = String(creatorObj.name);
        }

        if (Array.isArray(credits.cast)) {
          cast = credits.cast
            .slice(0, 5)
            .map((c: Record<string, unknown>) => String(c.name));
        }
      }

      return {
        tmdbId: detailResp.id,
        title: (isMovie ? detailResp.title : detailResp.name) ?? "未知标题",
        type,
        posterUrl: detailResp.poster_path
          ? `${TMDB_IMAGE_BASE}${detailResp.poster_path}`
          : null,
        backdropUrl: detailResp.backdrop_path
          ? `https://image.tmdb.org/t/p/original${detailResp.backdrop_path}`
          : null,
        overview: (detailResp.overview as string) ?? "",
        voteAverage:
          typeof detailResp.vote_average === "number"
            ? Math.round(detailResp.vote_average * 10) / 10
            : 0,
        year: year !== null && !isNaN(year) ? year : null,
        genres: (Array.isArray(detailResp.genres) ? detailResp.genres : [])
          .map((g: { name: string }) => GENRE_MAP_EN_ZH[g.name] || g.name)
          .filter(Boolean),
        cast: cast.length > 0 ? cast : null,
        director: director || null,
        tmdbData: detailResp,
      } as TmdbMetadata;
    } catch (err) {
      console.error(`[TMDB] 按 ID 获取详情失败: ${tmdbId}`, err);
      return null;
    }
  }) as Promise<TmdbMetadata | null>;
}

