import { describe, it, expect, vi, beforeEach } from "vitest";
import { MediaService } from "./media.service";
import { prisma } from "@/lib/db";
import { searchTmdbMetadata } from "@/lib/tmdb/client";

// 拦截数据库 Prisma 实例
vi.mock("@/lib/db", () => ({
  prisma: {
    series: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    episode: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    album: {
      upsert: vi.fn(),
    },
    track: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => {
      if (typeof cb === "function") {
        return cb(prisma);
      }
      return cb;
    }),
  },
}));

// 拦截外部抓取逻辑
vi.mock("@/lib/tmdb/client", () => ({
  searchTmdbMetadata: vi.fn(),
}));

describe("MediaService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("当导入新剧集或电影时，应触发主对象与子集的级联新建", async () => {
    (prisma.series.findUnique as import("vitest").Mock).mockResolvedValue(null);
    (prisma.series.create as import("vitest").Mock).mockResolvedValue({
      id: 1,
      title: "Test Series",
      type: "tv",
    });
    (prisma.series.update as import("vitest").Mock).mockResolvedValue({
      id: 1,
      title: "Test Series",
      type: "tv",
    });
    (prisma.episode.findMany as import("vitest").Mock).mockResolvedValue([]);
    // 拦截后台富化
    (searchTmdbMetadata as import("vitest").Mock).mockResolvedValue(null);

    const result = await MediaService.importSeries({
      inferredTitle: "Test Series",
      path: "/tv/test",
      configId: 1,
      videos: [
        {
          path: "/tv/test/ep1.mp4",
          name: "ep1.mp4",
          size: 1000,
          category: "video" as never,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.newEpisodes).toBe(1);
    expect(prisma.series.create).toHaveBeenCalled();
    expect(prisma.episode.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ title: "ep1.mp4", episodeNum: 1 }),
      ]),
      skipDuplicates: true,
    });
  });

  it("当重复导入该剧集并新增子集时，主对象应执行合并，子集入库时能实现自跳过去的排重效果", async () => {
    (prisma.series.findUnique as import("vitest").Mock).mockResolvedValue({
      id: 1,
      manualMatched: false,
    });
    (prisma.series.update as import("vitest").Mock).mockResolvedValue({
      id: 1,
      title: "Valid Series",
      type: "tv",
    });
    (prisma.series.create as import("vitest").Mock).mockResolvedValue({
      id: 1,
      title: "Valid Series",
      type: "tv",
    });
    // 但该剧集数据库里目前只入库了 ep1
    (prisma.episode.findMany as import("vitest").Mock).mockResolvedValue([
      { openlistPath: "/tv/test/ep1.mp4" },
    ]);
    (searchTmdbMetadata as import("vitest").Mock).mockResolvedValue(null);

    const result = await MediaService.importSeries({
      inferredTitle: "Valid Series",
      path: "/tv/test",
      configId: 1,
      videos: [
        {
          path: "/tv/test/ep1.mp4",
          name: "ep1.mp4",
          size: 1000,
          category: "video" as never,
        },
        {
          path: "/tv/test/ep2.mp4",
          name: "ep2.mp4",
          size: 2000,
          category: "video" as never,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.newEpisodes).toBe(1);
    expect(prisma.series.update).toHaveBeenCalled();
    expect(prisma.episode.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ title: "ep2.mp4" }),
      ]),
      skipDuplicates: true,
    });
  });
});
