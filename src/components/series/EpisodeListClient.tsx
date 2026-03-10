"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Episode {
    id: number;
    episodeNum: number;
    seasonNum: number;
    title?: string | null;
}

interface Props {
    seriesId: number;
    episodes: Episode[];
}

export default function EpisodeListClient({ seriesId, episodes }: Props) {
    const router = useRouter();

    const seasonMap = episodes.reduce<Record<number, Episode[]>>((acc, ep) => {
        const key = ep.seasonNum ?? 1;
        if (!acc[key]) acc[key] = [];
        acc[key].push(ep);
        return acc;
    }, {});

    const seasons = Object.keys(seasonMap).map(Number).sort((a, b) => a - b);
    const [activeSeason, setActiveSeason] = useState(seasons[0] ?? 1);
    const currentEps = seasonMap[activeSeason] ?? [];

    return (
        <div className="space-y-10">
            {seasons.length > 1 && (
                <div className="flex flex-wrap gap-3 p-1 rounded-3xl bg-white/5 border border-white/5 w-fit">
                    {seasons.map((s) => (
                        <button
                            key={s}
                            onClick={() => setActiveSeason(s)}
                            className={`px-8 py-3 rounded-2xl text-sm font-black transition-all duration-500 ${activeSeason === s ? "bg-blue-600 text-white shadow-xl" : "text-slate-400 hover:text-white"
                                }`}
                        >
                            第 {s} 季
                        </button>
                    ))}
                </div>
            )}

            <motion.div
                layout
                className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4"
            >
                <AnimatePresence mode="popLayout">
                    {currentEps.map((ep) => (
                        <motion.button
                            key={ep.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ scale: 1.05, y: -5 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.push(`/play/${seriesId}/${ep.id}`)}
                            className="aspect-[5/3] flex items-center justify-center rounded-[1.5rem] aura-glass font-black text-xl text-slate-400 hover:text-white hover:bg-white/10 hover:shadow-[0_0_20px_#ffffff33] hover:-translate-y-1 transition-all duration-300 ease-[var(--ease-smooth)]"
                        >
                            {ep.episodeNum}
                        </motion.button>
                    ))}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
