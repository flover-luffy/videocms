"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import StaggeredList from "@/components/layout/StaggeredList";
import MediaCard from "@/components/media-card/MediaCard";
import { motion, AnimatePresence } from "framer-motion";

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                if (!res.ok) {
                    throw new Error(`Search failed with status: ${res.status}`);
                }
                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("API returned non-JSON response");
                }
                const data = await res.json();
                setResults(data.items || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [query]);

    return (
        <PageLayout maxWidth="1600px">
            <div className="space-y-16 py-12">
                <div className="max-w-4xl mx-auto text-center space-y-10">
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-6xl sm:text-8xl font-black text-white italic uppercase tracking-tighter"
                    >
                        全站 <span className="text-blue-500 text-gradient">搜索</span>
                    </motion.h1>

                    <div className="relative group aura-glass rounded-[4rem] p-2">
                        <input
                            type="text"
                            placeholder="搜索影视、导演、演员..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full bg-transparent px-10 py-6 text-2xl font-black text-white placeholder:text-slate-600 focus:outline-none transition-all duration-700 outline-none"
                        />
                        <div className="absolute right-8 top-1/2 -translate-y-1/2">
                            {loading ? (
                                <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="w-8 h-8 text-slate-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {query && !loading && results.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="py-40 text-center"
                        >
                            <p className="text-slate-500 font-bold uppercase tracking-[0.3em]">未找到相关影视资源</p>
                        </motion.div>
                    ) : (
                        <div key="results" className="max-w-[1400px] mx-auto space-y-12">
                            {results.length > 0 && (
                                <div className="flex items-center gap-4 pl-4 border-l-2 border-blue-500/50">
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                        共找到 <span className="text-blue-500">{results.length}</span> 部内容
                                    </p>
                                </div>
                            )}
                            <StaggeredList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-8 gap-y-12">
                                {results.map((item) => (
                                    <MediaCard key={item.id} {...item} />
                                ))}
                            </StaggeredList>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </PageLayout>
    );
}
