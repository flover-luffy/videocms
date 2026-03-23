"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export interface BannerItem {
  id: number;
  title: string;
  backdropUrl: string | null;
  posterUrl: string | null; // 添加海报支待
  overview: string | null;
  year: number | null;
  voteAverage: number | null;
}

interface HeroBannerMobileProps {
  items: BannerItem[];
  page: number;
  direction: number;
  itemIndex: number;
  paginate: (direction: number) => void;
  setPage: (updater: (current: [number, number]) => [number, number]) => void;
  _reduceMotion: boolean;
  variants: unknown;
  swipePower: (offset: number, velocity: number) => number;
  swipeConfidenceThreshold: number;
}

export default function HeroBannerMobile({
  items,
  page,
  direction,
  itemIndex,
  paginate,
  setPage,
  _reduceMotion,
  variants,
  swipePower,
  swipeConfidenceThreshold,
}: HeroBannerMobileProps) {
  const current = items[itemIndex];

  return (
    <div className="relative w-full h-[85vh] min-h-[600px] overflow-hidden bg-[#0C0A09]">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={page}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 32 },
            opacity: { duration: 0.5 },
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={(event, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);
            if (swipe < -swipeConfidenceThreshold) paginate(1);
            else if (swipe > swipeConfidenceThreshold) paginate(-1);
          }}
          className="absolute inset-0"
        >
          {/* Layer 1: Cinematic Blurred Backdrop */}
          <div className="absolute inset-0 z-0">
            {current.backdropUrl ? (
              <div className="relative w-full h-full">
                <Image
                  src={current.backdropUrl}
                  alt=""
                  fill
                  className="object-cover opacity-50 blur-[40px] scale-110"
                  sizes="100vw"
                  suppressHydrationWarning
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0C0A09]/40 via-[#0C0A09]/60 to-[#0C0A09]" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-stone-900/40 via-[#0C0A09] to-black" />
            )}
          </div>

          {/* Layer 2: Hero Poster (The "Prudent" Choice) */}
          <div className="absolute inset-x-0 top-[10%] z-10 flex justify-center px-12 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: 0.1,
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative aspect-[2/3] w-full max-w-[280px] rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10"
            >
              <Image
                src={current.posterUrl || current.backdropUrl || ""}
                alt={current.title}
                fill
                priority={page === 0}
                className="object-cover"
                sizes="(max-w: 640px) 70vw, 30vw"
                suppressHydrationWarning
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-3xl" />
            </motion.div>
          </div>

          {/* Subtle Dynamic Ambient Lighting */}
          <div className="absolute inset-0 z-15 bg-radial-gradient from-amber-500/5 to-transparent pointer-events-none" />
        </motion.div>
      </AnimatePresence>

      {/* Content Container - Bottom Overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end px-6 pb-24 pt-48 bg-gradient-to-t from-[#0C0A09] via-[#0C0A09]/95 to-transparent">
        <motion.div
          key={`mobile-info-${current.id}`}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="pointer-events-auto space-y-5 text-center"
        >
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {current.voteAverage && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black">
                ★ {current.voteAverage.toFixed(1)}
              </span>
            )}
            <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">
              {current.year || "2024"} · SERIES
            </span>
          </div>

          {/* Dramatic Title */}
          <h1 className="font-outfit text-4xl font-extrabold tracking-tighter text-white drop-shadow-2xl">
            {current.title}
          </h1>

          {/* Overview - Refined Typography */}
          <p className="mx-auto max-w-[90%] text-sm font-medium leading-relaxed text-slate-400 line-clamp-2">
            {current.overview || "暂无这部内容的详细介绍。"}
          </p>

          {/* Vertical Actions - Premium Pill Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <Link
              href={`/series/${current.id}`}
              className="flex items-center justify-center gap-2.5 w-full rounded-full bg-white h-12 text-[15px] font-black text-black active:scale-[0.97] transition-all shadow-[0_8px_30px_rgb(255,255,255,0.2)]"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              立即播放
            </Link>
            <Link
              href={`/series/${current.id}`}
              className="flex items-center justify-center gap-2.5 w-full rounded-full bg-white/10 h-12 text-[15px] font-bold text-white border border-white/10 backdrop-blur-xl active:scale-[0.97] transition-all"
            >
              <svg
                className="w-5 h-5 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              更多信息
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Pagination - Sleek Progressive Dots */}
      <div className="pointer-events-auto absolute bottom-8 left-0 right-0 z-30 flex justify-center gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              const newDirection = i > itemIndex ? 1 : -1;
              setPage((currentPage) => [
                currentPage[0] + (i - itemIndex),
                newDirection,
              ]);
            }}
            className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
              i === itemIndex
                ? "w-8 bg-white"
                : "w-2 bg-white/20 hover:bg-white/40"
            }`}
            aria-label={`跳转至第 ${i + 1} 页`}
          />
        ))}
      </div>
    </div>
  );
}
