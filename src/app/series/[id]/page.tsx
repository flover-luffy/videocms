import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import EpisodeListClient from "@/components/series/EpisodeListClient";
import FavoriteButton from "@/components/ui/FavoriteButton";
import { prisma } from "@/lib/db";
import PageLayout from "@/components/layout/PageLayout";
import { normalizeJsonArray } from "@/lib/utils";

export const revalidate = 0;

export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const series = await prisma.series.findUnique({
        where: { id: parseInt(id, 10) },
        include: {
            episodes: {
                orderBy: [{ seasonNum: "asc" }, { episodeNum: "asc" }],
            },
        },
    });

    if (!series) notFound();

    const genres = normalizeJsonArray(series.genres);
    const cast = normalizeJsonArray(series.cast);
    const firstEp = series.episodes[0];

    return (
        <PageLayout immersive className="!px-0" maxWidth="100%">

            <div className="relative h-[70vh] w-full overflow-hidden">
                {series.backdropUrl && (
                    <Image
                        src={series.backdropUrl}
                        alt={series.title}
                        fill
                        priority
                        className="object-cover opacity-40 blur-[2px]"
                        suppressHydrationWarning
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#010204] via-[#010204]/60 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 max-w-[1700px] mx-auto px-8 pb-16 flex flex-col md:flex-row items-end gap-12">
                    {/* 海报卡片 */}
                    <div className="relative w-64 aspect-[2/3] rounded-[2.5rem] overflow-hidden bento-card shrink-0 hidden md:block group">
                        {series.posterUrl && (
                            <Image
                                src={series.posterUrl}
                                alt={series.title}
                                fill
                                className="object-cover group-hover:scale-110 transition-transform duration-[1.5s]"
                                suppressHydrationWarning
                            />
                        )}
                        <div className="absolute inset-0 rounded-[2.5rem] ring-1 ring-inset ring-white/20 pointer-events-none" />
                    </div>

                    {/* 信息区 */}
                    <div className="flex-1 space-y-6 md:pb-4 relative z-10 w-full">
                        <div className="flex flex-wrap items-center gap-3">
                            {series.voteAverage && (
                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl aura-glass bg-blue-600/20">
                                    <span className="text-[10px] font-black italic text-blue-400">TMDb</span>
                                    <span className="text-sm font-black text-white">{series.voteAverage.toFixed(1)}</span>
                                </div>
                            )}
                            <span className="px-4 py-1.5 rounded-xl aura-glass text-xs font-bold text-slate-200 tracking-widest">{series.year || "未知"}</span>
                            <span className="px-4 py-1.5 rounded-xl aura-glass text-xs font-bold text-slate-200 tracking-widest bg-white/5">{series.episodes.length} 集</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl">{series.title}</h1>

                        <div className="flex items-center gap-4">
                            {firstEp ? (
                                <Link
                                    href={`/play/${series.id}/${firstEp.id}`}
                                    className="btn-pill bg-white text-black hover:bg-slate-200 !px-10 !py-4"
                                >
                                    立即播放
                                </Link>
                            ) : (
                                <button disabled className="btn-pill bg-white/20 text-white/50 cursor-not-allowed !px-10 !py-4">
                                    暂无片源
                                </button>
                            )}
                            <FavoriteButton seriesId={series.id} />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {genres.map(g => (
                                <span key={g} className="px-5 py-2 rounded-full glass text-xs font-bold text-slate-300">
                                    {g}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 核心内容区 */}
            <div className="max-w-[1700px] mx-auto px-8 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-16 py-20 pb-40">
                <div className="space-y-20">
                    {/* 详情介绍 */}
                    <div className="space-y-8">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <span className="w-2 h-2 bg-blue-600 rounded-full" />
                            剧情简介
                        </h2>
                        <p className="text-xl text-slate-300 leading-relaxed font-medium opacity-80">
                            {series.overview || "暂无这部内容的详细内容介绍。"}
                        </p>
                    </div>

                    {/* 选集列表 */}
                    <div className="space-y-10">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <span className="w-2 h-2 bg-blue-600 rounded-full" />
                            追剧列表
                        </h2>
                        <EpisodeListClient seriesId={series.id} episodes={series.episodes} />
                    </div>
                </div>

                {/* 侧边信息栏 */}
                <aside className="space-y-12">
                    <div className="p-8 rounded-[3rem] glass space-y-8">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">综合评分</span>
                            <span className="text-3xl font-black text-blue-500 italic">★ {series.voteAverage?.toFixed(1) || "0.0"}</span>
                        </div>
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <FavoriteButton seriesId={series.id} />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">演职人员</h3>
                        <div className="flex flex-wrap gap-3">
                            {cast.map(c => (
                                <span key={c} className="px-4 py-2 rounded-xl bg-white/5 text-sm font-bold text-slate-400">
                                    {c}
                                </span>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </PageLayout>
    );
}
