"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface BannerItem {
    id: number;
    title: string;
    backdropUrl: string | null;
    overview: string | null;
    year: number | null;
    voteAverage: number | null;
}

interface Props {
    items: BannerItem[];
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
};

export default function HeroBannerClient({ items }: Props) {
    const [[page, direction], setPage] = useState([0, 0]);
    const [isPaused, setIsPaused] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // 计算实际的数组索引
    const itemIndex = ((page % items.length) + items.length) % items.length;

    const paginate = useCallback((newDirection: number) => {
        setPage([page + newDirection, newDirection]);
    }, [page]);

    // 自动轮播逻辑
    useEffect(() => {
        if (items.length <= 1 || isPaused) return;
        timerRef.current = setTimeout(() => {
            paginate(1);
        }, 8000);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [page, isPaused, items.length, paginate]);

    if (!items || items.length === 0) return null;

    const current = items[itemIndex];

    const variants = {
        enter: (direction: number) => {
            return {
                x: direction > 0 ? 1000 : -1000,
                opacity: 0,
                scale: 1.05
            };
        },
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction: number) => {
            return {
                zIndex: 0,
                x: direction < 0 ? 1000 : -1000,
                opacity: 0,
                scale: 0.95
            };
        }
    };

    return (
        <div
            className="relative h-full w-full overflow-hidden bg-[#0A0B10] group rounded-[3rem]"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <AnimatePresence initial={false} custom={direction}>
                <motion.div
                    key={page}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        x: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.8 },
                        scale: { duration: 1, ease: [0.23, 1, 0.32, 1] }
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1}
                    onDragEnd={(e, { offset, velocity }) => {
                        const swipe = swipePower(offset.x, velocity.x);
                        if (swipe < -swipeConfidenceThreshold) {
                            paginate(1);
                        } else if (swipe > swipeConfidenceThreshold) {
                            paginate(-1);
                        }
                    }}
                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                >
                    <div className="absolute inset-0 z-0">
                        {current.backdropUrl ? (
                            <Image
                                key={current.id}
                                src={current.backdropUrl}
                                alt={current.title}
                                fill
                                priority={itemIndex === 0}
                                className="object-cover"
                                sizes="100vw"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-[#0A0B10] to-purple-900/20" />
                        )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-[#0A0B10] via-[#0A0B10]/60 to-transparent pointer-events-none" />
                    <div className="absolute inset-y-0 left-0 w-3/4 bg-gradient-to-r from-[#0A0B10] via-[#0A0B10]/40 to-transparent pointer-events-none opacity-90" />
                </motion.div>
            </AnimatePresence>

            {/* 左右切换按钮 (悬停显示 - 尺寸调小) */}
            <div className="absolute inset-y-0 left-0 w-24 flex items-center justify-start pl-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <button
                    onClick={() => paginate(-1)}
                    className="w-12 h-12 rounded-full aura-glass flex items-center justify-center text-white pointer-events-auto hover:bg-blue-600/50 hover:scale-110 active:scale-95 transition-all"
                >
                    <svg className="w-6 h-6 -ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
            </div>
            <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-end pr-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <button
                    onClick={() => paginate(1)}
                    className="w-12 h-12 rounded-full aura-glass flex items-center justify-center text-white pointer-events-auto hover:bg-blue-600/50 hover:scale-110 active:scale-95 transition-all"
                >
                    <svg className="w-6 h-6 -mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* 文本内容区 */}
            <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end pb-16 px-10 sm:px-16 w-full">
                <div className="max-w-2xl space-y-6">
                    <motion.div
                        key={`info-${current.id}`}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 1, ease: [0.23, 1, 0.32, 1] }}
                        className="pointer-events-auto"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            {current.voteAverage && (
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg aura-glass bg-blue-600/20">
                                    <span className="text-blue-400 font-bold text-[10px] tracking-wider">TMDB</span>
                                    <span className="text-white font-black text-sm">{current.voteAverage.toFixed(1)}</span>
                                </div>
                            )}
                            <span className="px-3 py-1 rounded-lg aura-glass text-slate-200 font-bold uppercase tracking-widest text-xs">{current.year || "2024"}</span>
                        </div>

                        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tighter mb-4 drop-shadow-2xl">
                            {current.title}
                        </h1>

                        <p className="text-lg text-slate-300 font-medium leading-relaxed line-clamp-2 mb-8 max-w-xl drop-shadow-lg">
                            {current.overview || "暂无这部内容的详细内容介绍。"}
                        </p>

                        <div className="flex flex-wrap items-center gap-4">
                            <Link href={`/series/${current.id}`} className="btn-pill bg-white text-black hover:bg-slate-200">
                                立刻观看
                            </Link>
                            <Link href={`/series/${current.id}`} className="px-6 py-3.5 rounded-full aura-glass font-bold text-white hover:bg-white/10 transition-colors uppercase tracking-widest text-sm">
                                详情
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* 底部进度指示器 */}
            <div className="absolute bottom-6 left-10 sm:left-16 right-10 sm:right-16 z-20 flex gap-2 pointer-events-auto">
                {items.map((_, i) => {
                    const isActive = i === itemIndex;
                    return (
                        <button
                            key={i}
                            onClick={() => {
                                const newDirection = i > itemIndex ? 1 : -1;
                                setPage([page + (i - itemIndex), newDirection]);
                            }}
                            className="relative h-1 flex-1 rounded-full overflow-hidden bg-white/20 hover:bg-white/40 transition-colors group cursor-pointer"
                        >
                            {isActive && (
                                <motion.div
                                    className="absolute inset-0 bg-blue-500"
                                    initial={{ width: "0%" }}
                                    animate={{ width: isPaused ? "100%" : "100%" }}
                                    transition={isPaused ? { duration: 0 } : { duration: 8, ease: "linear" }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
