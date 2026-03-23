"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export interface BannerItem {
  id: number;
  title: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  overview: string | null;
  year: number | null;
  voteAverage: number | null;
}

interface HeroBannerDesktopProps {
  items: BannerItem[];
  page: number;
  direction: number;
  itemIndex: number;
  setIsPaused: (paused: boolean) => void;
  paginate: (direction: number) => void;
  setPage: (updater: (current: [number, number]) => [number, number]) => void;
  reduceMotion: boolean;
  variants: unknown;
  swipePower: (offset: number, velocity: number) => number;
  swipeConfidenceThreshold: number;
}

export default function HeroBannerDesktop({
  items,
  page,
  direction,
  itemIndex,
  setIsPaused,
  paginate,
  setPage,
  reduceMotion,
  variants,
  swipePower,
  swipeConfidenceThreshold,
}: HeroBannerDesktopProps) {
  const current = items[itemIndex];

  return (
    <div
      className="group relative w-full h-[85vh] max-h-[1000px] min-h-[600px] overflow-hidden bg-[#0C0A09]"
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
          transition={
            reduceMotion
              ? { opacity: { duration: 0.3 } }
              : {
                  x: { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 1.2 },
                  opacity: { duration: 1 },
                  scale: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
                }
          }
          drag={reduceMotion ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={reduceMotion ? 0 : 0.8}
          onDragEnd={(event, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);
            if (swipe < -swipeConfidenceThreshold) paginate(1);
            else if (swipe > swipeConfidenceThreshold) paginate(-1);
          }}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
        >
          <div className="absolute inset-0 z-0">
            {current.backdropUrl ? (
              <Image
                src={current.backdropUrl}
                alt={current.title}
                fill
                priority={page === 0}
                className="object-cover"
                style={{ objectPosition: "center top" }}
                sizes="100vw"
                suppressHydrationWarning
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-stone-900/40 via-[#0C0A09] to-amber-900/20" />
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[65vh] bg-gradient-to-t from-[#0C0A09] via-[#0C0A09]/70 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[45vw] bg-gradient-to-r from-black/50 via-black/10 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[15vh] bg-gradient-to-b from-black/20 to-transparent z-10" />
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 z-20 flex w-full flex-col justify-end px-[4vw] pb-24 sm:pb-32 lg:pb-40">
        <div className="max-w-2xl space-y-5 sm:max-w-3xl">
          <motion.div
            key={`info-${current.id}`}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.2 }
                : { delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }
            }
            className="pointer-events-auto"
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="flex items-center justify-center font-black tracking-widest bg-white/10 text-white/90 text-[11px] uppercase px-2.5 py-1 rounded backdrop-blur-md">
                ROM&apos;S ORIGINAL
              </span>
              {current.voteAverage ? (
                <div className="flex items-center gap-1.5 rounded bg-amber-500/15 px-2.5 py-1 backdrop-blur-md border border-amber-500/20">
                  <span className="text-[10px] font-black tracking-wider text-amber-500">
                    TMDB
                  </span>
                  <span className="text-sm font-black text-white">
                    {current.voteAverage.toFixed(1)}
                  </span>
                </div>
              ) : null}
              <span className="rounded bg-white/5 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-slate-300 backdrop-blur-md border border-white/5">
                {current.year || "2024"}
              </span>
            </div>

            <h1 className="mb-4 font-outfit text-5xl font-black leading-[1.05] tracking-tighter text-white drop-shadow-2xl sm:text-6xl lg:text-[7rem]">
              {current.title}
            </h1>

            <p className="mb-8 max-w-xl text-sm font-semibold leading-relaxed text-slate-300 drop-shadow-lg line-clamp-3 sm:text-base md:text-lg">
              {current.overview ||
                "暂无这部内容的详细介绍。探访全域影像档案库了解更多详情。"}
            </p>

            <div className="flex items-center gap-4 mt-6">
              <Link
                href={`/series/${current.id}`}
                className="flex items-center justify-center gap-2 rounded bg-white px-6 py-3.5 text-[15px] font-black tracking-wide text-black transition-all hover:bg-slate-200 active:scale-95 shadow-[0_4px_14px_rgba(255,255,255,0.25)]"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                播放
              </Link>
              <Link
                href={`/series/${current.id}`}
                className="flex items-center justify-center gap-2 rounded bg-white/10 px-6 py-3.5 text-[15px] font-bold tracking-wide text-white transition-all hover:bg-white/20 hover:text-white backdrop-blur-md active:scale-95"
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
                详细信息
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-8 sm:bottom-12 left-[4vw] z-30 flex gap-2">
        {items.map((_, i) => {
          const isActive = i === itemIndex;
          return (
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
              className={`h-1.5 rounded-full transition-all duration-500 ease-[var(--ease-smooth)] ${
                isActive
                  ? "w-10 bg-white"
                  : "w-2 bg-white/20 hover:bg-white/40 hover:w-5"
              }`}
              aria-label={`跳转到第 ${i + 1} 张`}
            />
          );
        })}
      </div>
    </div>
  );
}
