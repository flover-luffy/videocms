"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

interface MediaCardProps {
    id: number;
    title: string;
    posterUrl: string | null;
    voteAverage?: number | null;
    year?: number | null;
    episodeCount?: number;
}

export default function MediaCard({ id, title, posterUrl, voteAverage, year, episodeCount }: MediaCardProps) {
    return (
        <motion.div
            whileHover={{ y: -8 }}
            transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
            className="group relative flex flex-col gap-3.5"
        >
            <Link href={`/series/${id}`}>
                {/* 核心海报区域 */}
                <div className="relative aspect-[2/3] rounded-[1.75rem] overflow-hidden bg-[#0A0B10] shadow-[0_15px_35px_-5px_#00000088] transition-all duration-700 ease-[var(--ease-smooth)] group-hover:shadow-[0_25px_60px_-10px_#5c6ac455] ring-1 ring-white/10 group-hover:ring-white/30 transform-gpu">
                    {posterUrl ? (
                        <Image
                            src={posterUrl}
                            alt={title}
                            fill
                            className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                            sizes="(max-w: 768px) 50vw, (max-w: 1200px) 25vw, 15vw"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-white/5 to-white/[0.02]">
                            <span className="text-blue-500/20 font-black text-7xl select-none">{title[0]}</span>
                            <p className="text-slate-600 font-bold text-[10px] uppercase tracking-widest mt-4">无海报</p>
                        </div>
                    )}

                    {/* 评分角标：尺寸微调，更精致 */}
                    {voteAverage && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-blue-600/85 backdrop-blur-md border border-blue-400/40 shadow-lg z-20">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-black text-white leading-tight">{voteAverage.toFixed(1)}</span>
                            </div>
                        </div>
                    )}

                    {/* 类型角标：左上角 */}
                    {(episodeCount !== undefined || true) && (
                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 z-20">
                            <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">
                                {episodeCount === 1 ? "电影" : "剧集"}
                            </span>
                        </div>
                    )}

                    {/* 底阴影光效 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-40 group-hover:opacity-20 transition-opacity duration-700" />
                    <div className="absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/10 pointer-events-none" />
                </div>

                {/* 底部信息栏：优化字号与悬停稳定性 */}
                <div className="px-1.5 py-1 flex flex-col gap-1.5 transform-gpu">
                    <h3 className="text-[17px] font-bold text-white/90 group-hover:text-blue-400 transition-colors duration-400 truncate tracking-tight antialiased">
                        {title}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-white/[0.03] px-2 py-0.5 rounded">
                            {year || "未知"}
                        </span>
                        {episodeCount !== undefined && (
                            <span className="text-[10px] font-bold text-blue-500/60 uppercase tracking-tighter">
                                {episodeCount} 话
                            </span>
                        )}
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
