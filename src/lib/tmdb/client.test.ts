import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchTmdbMetadata } from "./client";
import { tmdbMetadataCache } from "@/lib/cache";

// Mock p-queue 以加速测试执行，跳过排队等待
vi.mock("p-queue", () => {
  return {
    default: class PQueue {
      add(fn: any) {
        return fn();
      }
    },
  };
});

describe("TMDB Client", () => {
  beforeEach(async () => {
    // 重置所有拦截并清空内部缓存，以防用例间污染
    vi.restoreAllMocks();
    await tmdbMetadataCache.clear();
    global.fetch = vi.fn();
  });

  it("应当能正确发出提取请求，并对电影元数据及其关联主创执行清洗与映射", async () => {
    const mockSearchResponse = {
      results: [
        { id: 123, media_type: "movie", vote_count: 100, title: "Inception" },
      ],
    };
    const mockDetailResponse = {
      id: 123,
      title: "Inception",
      overview: "A mind-bending thriller",
      poster_path: "/poster.jpg",
      release_date: "2010-07-15",
      vote_average: 8.8,
      genres: [{ name: "Action" }, { name: "Science Fiction" }],
      credits: {
        crew: [{ job: "Director", name: "Christopher Nolan" }],
        cast: [{ name: "Leonardo DiCaprio" }, { name: "Joseph Gordon-Levitt" }],
      },
    };

    // 模拟第一次 search 及其后根据 ID 发送的 details
    (global.fetch as import("vitest").Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockSearchResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailResponse,
      });

    const result = await searchTmdbMetadata("Inception");

    expect(result).toBeDefined();
    expect(result?.title).toBe("Inception");
    expect(result?.type).toBe("movie");
    expect(result?.year).toBe(2010);
    expect(result?.director).toBe("Christopher Nolan");
    expect(result?.cast).toHaveLength(2);
    // 验证翻译策略表被正确命中
    expect(result?.genres).toContain("动作");
    expect(result?.genres).toContain("科幻");
  });

  it("当检索结果为空时，应提前返回 null", async () => {
    (global.fetch as import("vitest").Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [], total_results: 0 }),
    });

    const result = await searchTmdbMetadata("UnknownMovie123XYZ");
    expect(result).toBeNull();
  });
});
