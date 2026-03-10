"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import VideoPlayer from "@/components/player/VideoPlayerWrapper";
import PageLayout from "@/components/layout/PageLayout";
import { normalizeJsonArray } from "@/lib/utils";
import { useEffect, useState } from "react";
import FavoriteButton from "@/components/ui/FavoriteButton";

interface PlayData {
    episode: any;
    allEpisodes: any[];
}

export default function PlayPage({ params }: { params: Promise<{ seriesId: string; episodeId: string }> }) {
    const [data, setData] = useState<PlayData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const { seriesId, episodeId } = await params;
            const res = await fetch(`/api/play/page-data?seriesId=${seriesId}&episodeId=${episodeId}`);
            if (res.ok) {
                const playData = await res.json();
                setData(playData);
            } else {
                notFound();
            }
            setLoading(false);
        };
        load();
    }, [params]);

    const [isExpanded, setIsExpanded] = useState(false);

    const { episode, allEpisodes } = data || { episode: null, allEpisodes: [] };
    const series = episode?.series;
    const genres = series ? normalizeJsonArray(series.genres) : [];

    const isLongDescription = Boolean(series?.overview && series.overview.length > 120);

    if (loading) return <div className="min-h-screen bg-[#010204]" />;
    if (!data) return notFound();

    return (
        <PageLayout maxWidth="1700px">
            <div className="space-y-12">
                {/* 面包屑导航 */}
                <nav className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-slate-500">
                    <Link href="/" className="hover:text-white transition-colors">主页</Link>
                    <span className="opacity-20">/</span>
                    <Link href={`/series/${series.id}`} className="hover:text-white transition-colors truncate max-w-[200px]">{series.title}</Link>
                    <span className="opacity-20">/</span>
                    <span className="text-blue-500 italic">第 {episode.episodeNum} 集</span>
                </nav>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8 items-start">
                    {/* 播放器主视窗 */}
                    <div className="space-y-8">
                        {/* 悬浮播放器便当盒 */}
                        <div className="bento-card p-2 md:p-4 relative">
                            <div className="relative rounded-[2rem] overflow-hidden bg-black shadow-inner ring-1 ring-white/10">
                                <VideoPlayer seriesId={series.id} episodeId={episode.id} playlist={allEpisodes} />
                            </div>
                        </div>

                        {/* 播放器下方信息区便当盒 */}
                        <div className="bento-card p-8 flex flex-col md:flex-row justify-between items-start gap-8">
                            <div className="space-y-6 flex-grow">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">
                                            {series.title}
                                        </h1>
                                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 font-black text-sm rounded-lg border border-blue-500/30">
                                            第 {episode.episodeNum} 集
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {genres.slice(0, 5).map((g: string) => (
                                            <span key={g} className="px-3 py-1.5 rounded-xl bg-white/5 text-[11px] font-bold text-slate-300">
                                                {g}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="relative group">
                                    <p className={`max-w-3xl text-slate-300 text-[15px] font-medium leading-relaxed transition-all duration-300 ${!isExpanded && isLongDescription ? "line-clamp-3" : ""}`}>
                                        {series.overview}
                                    </p>
                                    {isLongDescription && (
                                        <button
                                            onClick={() => setIsExpanded(!isExpanded)}
                                            className="mt-2 text-xs font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors flex items-center gap-1"
                                        >
                                            {isExpanded ? (
                                                <>收起简介 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg></>
                                            ) : (
                                                <>展开全文 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="shrink-0 mt-2 flex items-center gap-4">
                                <FavoriteButton seriesId={series.id} />
                            </div>
                        </div>
                    </div>

                    <aside className="xl:sticky xl:top-32 h-[400px] xl:h-[calc(100vh-160px)] xl:max-h-[850px] bento-card p-6 md:p-8 flex flex-col shadow-[0_20px_50px_#00000066]">
                        {/* 固定的标题栏 */}
                        <div className="flex justify-between items-end shrink-0 mb-6 border-b border-white/10 pb-4">
                            <h2 className="text-xl font-black text-white tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" /> 选集列表
                            </h2>
                            <span className="text-xs font-bold text-slate-500 tracking-widest bg-white/5 px-3 py-1 rounded-lg">共 {allEpisodes.length} 集</span>
                        </div>

                        <div className="flex-grow overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-3">
                            <div className="grid grid-cols-4 sm:grid-cols-5 xl:grid-cols-4 gap-3">
                                {allEpisodes.map((ep) => {
                                    const isCurrent = ep.id === episode.id;
                                    return (
                                        <Link
                                            key={ep.id}
                                            href={`/play/${series.id}/${ep.id}`}
                                            className={`aspect-[5/3] flex items-center justify-center rounded-2xl text-sm font-black transition-all duration-300 ease-[var(--ease-smooth)] hover:scale-105 hover:-translate-y-1 ${isCurrent
                                                ? "bg-blue-600 text-white shadow-[0_10px_20px_#3b82f666] ring-2 ring-blue-400/50"
                                                : "aura-glass text-slate-400 hover:text-white hover:bg-white/10 hover:shadow-[0_8px_20px_#ffffff1a]"
                                                }`}
                                        >
                                            {ep.episodeNum}
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </PageLayout>
    );
}
