"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import StaggeredList from "@/components/layout/StaggeredList";
import MediaCard from "@/components/media-card/MediaCard";
import { motion, AnimatePresence } from "framer-motion";

export default function LibraryPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [type, setType] = useState("movie");

    useEffect(() => {
        const fetchParams = async () => {
            const { type: t } = await searchParams;
            if (t) setType(t);
        };
        fetchParams();
    }, [searchParams]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/series?type=${type}&limit=48`);
                const data = await res.json();
                setItems(data.items || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [type]);

    return (
        <PageLayout maxWidth="1700px">
            <div className="space-y-16 py-12">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-6xl sm:text-8xl font-black text-white italic uppercase tracking-tighter"
                        >
                            影视 <span className="text-blue-500 text-gradient">库</span>
                        </motion.h1>
                        <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs mt-4">在这里，发现属于您的精彩影视资源</p>
                    </div>

                    <div className="flex p-1.5 rounded-[2rem] aura-glass">
                        {[{ id: "movie", label: "电影" }, { id: "tv", label: "电视剧" }].map(btn => (
                            <button
                                key={btn.id}
                                onClick={() => setType(btn.id)}
                                className={`px-8 py-3.5 rounded-[1.5rem] text-sm font-black transition-all duration-500 ease-[var(--ease-smooth)] ${type === btn.id ? "bg-white text-black shadow-[0_5px_20px_#ffffff4d] scale-105" : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-40 flex flex-col items-center gap-6">
                            <div className="w-16 h-16 border-2 border-slate-500/20 border-t-white rounded-full animate-spin" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">正在载入影库数据</p>
                        </motion.div>
                    ) : items.length === 0 ? (
                        <motion.div key="empty" className="py-40 text-center bento-card rounded-[4rem]">
                            <p className="text-slate-500 font-bold uppercase tracking-[0.3em]">未找到相关影视资源</p>
                        </motion.div>
                    ) : (
                        <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <StaggeredList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-10 gap-y-16">
                                {items.map(item => <MediaCard key={item.id} {...item} />)}
                            </StaggeredList>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </PageLayout>
    );
}
