import { Prisma } from "@prisma/client";
import PageLayout from "@/components/layout/PageLayout";
import HeroBannerClient from "@/components/page/HeroBannerClient";
import MediaRowClient from "@/components/media-card/MediaRowClient";
import { prisma } from "@/lib/db";
import { getServerIsMobile } from "@/lib/device";

export const dynamic = "force-dynamic";

type SeriesWithCount = Prisma.SeriesGetPayload<{
  include: { _count: { select: { episodes: true } } };
}>;

export default async function HomePage() {
  const isMobile = await getServerIsMobile();

  // 聚合查询
  const results = await Promise.allSettled([
    prisma.series.findMany({
      where: { isFeatured: true },
      take: 10,
      orderBy: { playCount: "desc" },
      include: { _count: { select: { episodes: true } } },
    }),
    prisma.series.findMany({
      orderBy: { playCount: "desc" },
      take: 20,
      include: { _count: { select: { episodes: true } } },
    }),
    prisma.series.findMany({
      orderBy: { voteAverage: "desc" },
      take: 20,
      include: { _count: { select: { episodes: true } } },
    }),
    prisma.series.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { _count: { select: { episodes: true } } },
    }),
  ]);

  const [featuredRes, trendingRes, highlyRatedRes, latestRes] = results;

  let featured: SeriesWithCount[] = [];
  let trending: SeriesWithCount[] = [];
  let highlyRated: SeriesWithCount[] = [];
  let latest: SeriesWithCount[] = [];

  if (featuredRes.status === "fulfilled" && featuredRes.value)
    featured = featuredRes.value;
  if (trendingRes.status === "fulfilled" && trendingRes.value)
    trending = trendingRes.value;
  if (highlyRatedRes.status === "fulfilled" && highlyRatedRes.value)
    highlyRated = highlyRatedRes.value;
  if (latestRes.status === "fulfilled" && latestRes.value)
    latest = latestRes.value;

  // 智能兜底：大图轮播必须有高质感图片
  if (!featured || featured.length === 0) {
    featured = trending
      .filter((s: SeriesWithCount) => s.backdropUrl)
      .slice(0, 8);
  }

  const mapSeries = (items: SeriesWithCount[]) =>
    items.map((series) => ({
      ...series,
      episodeCount: series._count?.episodes,
      type: series.type || "series",
    }));

  const takeUnique = (
    items: SeriesWithCount[],
    seenIds: Set<number>,
    limit = 20,
  ) => {
    const unique: SeriesWithCount[] = [];
    for (const item of items) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      unique.push(item);
      if (unique.length >= limit) break;
    }
    return unique;
  };

  const featuredItems = featured.map((series: SeriesWithCount) => ({
    ...series,
    episodeCount: series._count?.episodes,
    type: "series",
  }));

  const seenIds = new Set<number>();
  const trendingItems = takeUnique(mapSeries(trending), seenIds, 20);
  const highlyRatedItems = takeUnique(mapSeries(highlyRated), seenIds, 20);
  const latestItems = takeUnique(mapSeries(latest), seenIds, 20);

  const rows = [
    {
      title: "热门播放",
      items: trendingItems,
      href: "/library/videos",
      layout: "row" as const,
      autoScroll: true,
    },
    {
      title: "高分推荐",
      items:
        highlyRatedItems.length > 0 ? highlyRatedItems : mapSeries(highlyRated),
      href: "/library/videos?sort=voteAverage",
      layout: "grid" as const,
    },
    {
      title: "最近更新",
      items: latestItems.length > 0 ? latestItems : mapSeries(latest),
      href: "/library/videos?sort=updatedAt",
      layout: "row" as const,
    },
  ];

  return (
    <PageLayout immersive={true}>
      {/* 全宽流媒体主视图 */}
      <div className="w-full flex flex-col pb-24">
        {/* 100vw 电影级头图 */}
        <HeroBannerClient items={featuredItems} isMobile={isMobile} />

        {/* 层叠内容区：解除强制重叠，仅通过极其微小的负偏移连接，确保不会遮挡上方进度条和文字区 */}
        <div className="w-full relative z-20 -mt-6 sm:-mt-10 pb-12 flex flex-col gap-6 sm:gap-12">
          {rows.map((row) => (
            <MediaRowClient
              key={row.title}
              title={row.title}
              items={row.items}
              href={row.href}
              layout={row.layout}
              autoScroll={row.autoScroll}
            />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
