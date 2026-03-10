"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import StaggeredList from "@/components/layout/StaggeredList";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function HistoryPage() {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch("/api/user/watch-history");
                const data = await res.json();
                setHistory(data.history || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    return (
        <PageLayout maxWidth="1600px">
            <div className="space-y-20 py-12">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-6xl sm:text-8xl font-black text-white italic uppercase tracking-tighter"
                        >
                            最近 <span className="text-blue-500 text-gradient">观看</span>
                        </motion.h1>
                        <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs mt-4">记录您的每一场视听盛宴</p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <span className="block text-2xl font-black text-white italic">{history.length}</span>
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">部足迹</span>
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div className="py-40 flex flex-col items-center gap-6">
                        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        <p className="text-slate-600 font-bold text-[10px] uppercase tracking-widest animate-pulse">正在加载记录...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="py-40 text-center glass rounded-[4rem] border-dashed">
                        <p className="text-slate-500 font-medium">暂无观看记录，开启探索您的首场影片吧。</p>
                        <Link href="/" className="mt-10 btn-premium py-3 px-8 text-xs">前往首页</Link>
                    </div>
                ) : (
                    <StaggeredList className="grid grid-cols-1 gap-6">
                        {history.map((record) => {
                            const ep = record.episode;
                            const series = ep.series;
                            const progress = record.duration ? (record.position / record.duration) * 100 : 0;

                            return (
                                <Link
                                    key={record.id}
                                    href={`/play/${series.id}/${ep.id}`}
                                    className="group relative flex flex-col md:flex-row gap-8 p-6 rounded-[2.5rem] glass hover:border-blue-500/30 transition-all duration-700"
                                >
                                    <div className="relative w-full md:w-64 aspect-video rounded-3xl overflow-hidden shrink-0">
                                        <Image
                                            src={series.backdropUrl || series.posterUrl || ""}
                                            alt={series.title}
                                            fill
                                            className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                className="h-full bg-blue-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col justify-center space-y-3">
                                        <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter truncate">{series.title}</h3>
                                        <div className="flex items-center gap-4">
                                            <span className="text-blue-500 font-black text-xs italic">第 {ep.episodeNum} 集</span>
                                            <span className="text-slate-600 font-bold text-[10px]">上次访问: {new Date(record.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center md:px-10">
                                        <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-500">
                                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </StaggeredList>
                )}
            </div>
        </PageLayout>
    );
}
