import { prisma } from "@/lib/db";
import PageLayout from "@/components/layout/PageLayout";
import HeroBannerClient from "@/components/page/HeroBannerClient";
import MediaCard from "@/components/media-card/MediaCard";
import StaggeredList from "@/components/layout/StaggeredList";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let [featured] = await Promise.all([
    prisma.series.findMany({ where: { isFeatured: true }, take: 5, include: { _count: { select: { episodes: true } } } })
  ]);
  const [trending, highlyRated, latest] = await Promise.all([
    prisma.series.findMany({ orderBy: { playCount: "desc" }, take: 12, include: { _count: { select: { episodes: true } } } }),
    prisma.series.findMany({ orderBy: { voteAverage: "desc" }, take: 12, include: { _count: { select: { episodes: true } } } }),
    prisma.series.findMany({ orderBy: { updatedAt: "desc" }, take: 12, include: { _count: { select: { episodes: true } } } }),
  ]);

  if (!featured || featured.length === 0) {
    featured = await prisma.series.findMany({
      where: { backdropUrl: { not: null } },
      orderBy: { playCount: "desc" },
      take: 5,
      include: { _count: { select: { episodes: true } } }
    });
  }

  featured = featured.map((s: any) => ({
    ...s,
    episodeCount: s._count?.episodes,
    type: "series"
  }));

  const mapSeries = (items: any[]) => items.map(s => ({
    ...s,
    episodeCount: s._count?.episodes,
    type: s.type || "series"
  }));

  const Sections = [
    { title: "最受关注", items: mapSeries(trending), icon: "🔥", href: "/library/videos" },
    { title: "高分必看", items: mapSeries(highlyRated), icon: "⭐️", href: "/library/videos" },
    { title: "最近更新", items: mapSeries(latest), icon: "✨", href: "/library/videos" },
  ];

  return (
    <PageLayout immersive className="!px-0" maxWidth="100%">
      <div className="max-w-[1920px] mx-auto px-6 lg:px-12 pt-32 pb-40 space-y-32">
        {/* Bento Grid Header (首屏便当盒) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 h-auto lg:h-[700px]">
          {/* Main Showcase (左侧大画框 8 栅格) */}
          <div className="lg:col-span-8 h-[600px] lg:h-full bento-card p-0">
            <HeroBannerClient items={featured} />
          </div>

          {/* Side Glances (右侧小模块 4 栅格) */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:gap-8 h-[600px] lg:h-full">
            {/* Top Right: 高频追剧 (本周热播 Top 3) */}
            <div className="flex-1 bento-card p-8 flex flex-col overflow-hidden relative">
              <h3 className="text-xl font-black text-white tracking-widest mb-6 flex items-center justify-between">
                <span>实时热播</span>
                <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">TOP 3</span>
              </h3>

              <div className="flex flex-col gap-4 flex-1">
                {trending.slice(0, 3).map((item, idx) => (
                  <Link key={item.id} href={`/series/${item.id}`} className="flex items-center gap-4 group/item">
                    <span className={`text-2xl font-black italic w-6 text-center ${idx === 0 ? "text-blue-500" : "text-slate-600"}`}>{idx + 1}</span>
                    <div className="relative w-16 aspect-[4/3] rounded-xl overflow-hidden shadow-md">
                      {item.posterUrl && <Image src={item.posterUrl} alt={item.title} fill className="object-cover transition-transform group-hover/item:scale-110" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate transition-colors group-hover/item:text-blue-400">{item.title}</h4>
                      <span className="text-xs font-bold text-slate-500">{item.year || "2024"} · {item.voteAverage?.toFixed(1) || "N/A"} 分</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Bottom Right: Promo/Search */}
            <div className="h-56 bento-card bg-gradient-to-tr from-indigo-900/40 via-blue-900/20 to-transparent p-8 flex flex-col justify-end relative group/promo overflow-hidden">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover/promo:bg-blue-400/30 transition-colors duration-700" />
              <h3 className="text-3xl font-black text-white mb-2 leading-tight drop-shadow-md">
                探索海量<br /><span className="text-blue-400">影视资源</span>
              </h3>
              <Link href="/library/videos" className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-slate-300 hover:text-white uppercase tracking-widest transition-colors w-max">
                查看全部 <svg className="w-5 h-5 transition-transform group-hover/promo:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
        </section>

        {/* 底部常规内容板块 */}
        <div className="space-y-40">
          {Sections.map((sec) => (
            <section key={sec.title} className="space-y-10 group">
              <div className="flex items-end justify-between border-l-4 border-blue-500 pl-8">
                <div>
                  <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-2">
                    {sec.title}
                  </h2>
                  <div className="text-sm font-bold text-slate-500 tracking-wider">
                    {sec.items.length} 部精选内容
                  </div>
                </div>
                <Link href={sec.href} className="btn-pill !px-6 !py-2 !text-xs bg-white/5 text-white hover:bg-white/15">
                  浏览全部
                </Link>
              </div>

              {sec.items.length > 0 ? (
                <StaggeredList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-12">
                  {sec.items.map((item) => (
                    <MediaCard key={item.id} {...item} />
                  ))}
                </StaggeredList>
              ) : (
                <div className="h-64 rounded-[2.5rem] mt-8 bg-white/5 border border-white/5 flex items-center justify-center">
                  <p className="text-slate-500 font-bold tracking-widest">影视资源库加载中...</p>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
