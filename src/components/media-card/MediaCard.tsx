"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { memo } from "react";

export interface MediaCardProps {
  id: number;
  title: string;
  posterUrl: string | null;
  voteAverage?: number | null;
  year?: number | null;
  episodeCount?: number;
  type?: string;
}

function MediaCard({
  id,
  title,
  posterUrl,
  voteAverage,
  year,
  episodeCount,
}: MediaCardProps) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      className="group relative flex flex-col gap-3 w-full"
    >
      <Link href={`/series/${id}`} className="focus-visible:outline-none">
        {/* 影院级海报容器 (Strict 2:3 logic) */}
        <div className="relative aspect-[2/3] w-full rounded-2xl sm:rounded-[1.5rem] overflow-hidden bg-[#1C1917] transition-all duration-700 ease-[var(--ease-smooth)] transform-gpu shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
              sizes="(max-w: 768px) 50vw, (max-w: 1200px) 25vw, 20vw"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0C0A09]">
              <span className="text-white/10 font-outfit font-black text-6xl select-none">
                {title[0]}
              </span>
            </div>
          )}

          {/* 海报内边缘发光 (Subtle Ring) */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-[1.5rem] ring-1 ring-inset ring-white/10" />

          {/* 底部渐变蒙层 */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </div>

        {/* 文字流 - 移动端针对性排版 */}
        <div className="pt-3 pb-1 flex flex-col gap-1 sm:gap-1.5 px-0.5">
          <h3 className="font-outfit text-[15px] sm:text-lg font-bold text-white/90 group-hover:text-white transition-colors duration-300 truncate tracking-tight antialiased">
            {title}
          </h3>
          <div className="flex items-center font-bold text-slate-500/80 gap-2 text-[10px] sm:gap-2.5 sm:text-[12px]">
            {year && <span className="text-slate-400">{year}</span>}
            {episodeCount !== undefined && (
              <>
                <span className="w-px h-2 bg-white/10" />
                <span>{episodeCount} 话</span>
              </>
            )}
            {voteAverage != null && voteAverage > 0 && (
              <>
                <span className="w-px h-2 bg-white/10" />
                <span className="text-amber-500/90 flex items-center gap-0.5">
                  ★ {voteAverage.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// 使用React.memo优化，避免不必要的重渲染
export default memo(MediaCard);
