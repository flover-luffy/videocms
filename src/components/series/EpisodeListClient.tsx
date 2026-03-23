"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

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

const EPISODES_PER_PAGE = 20;

export default function EpisodeListClient({ seriesId, episodes }: Props) {
  const router = useRouter();

  const seasonMap = episodes.reduce<Record<number, Episode[]>>(
    (acc, episode) => {
      const key = episode.seasonNum ?? 1;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(episode);
      return acc;
    },
    {},
  );

  const seasons = Object.keys(seasonMap)
    .map(Number)
    .sort((a, b) => a - b);
  const [activeSeason, setActiveSeason] = useState(seasons[0] ?? 1);
  const [activePage, setActivePage] = useState(1);

  const currentEpisodes = seasonMap[activeSeason] ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil(currentEpisodes.length / EPISODES_PER_PAGE),
  );
  const clampedPage = Math.min(activePage, totalPages);
  const pageStart = (clampedPage - 1) * EPISODES_PER_PAGE;
  const pagedEpisodes = currentEpisodes.slice(
    pageStart,
    pageStart + EPISODES_PER_PAGE,
  );
  const pageRanges = Array.from({ length: totalPages }, (_, index) => {
    const startIndex = index * EPISODES_PER_PAGE;
    const endIndex = Math.min(
      currentEpisodes.length - 1,
      startIndex + EPISODES_PER_PAGE - 1,
    );
    const startEpisodeNum =
      currentEpisodes[startIndex]?.episodeNum ?? startIndex + 1;
    const endEpisodeNum = currentEpisodes[endIndex]?.episodeNum ?? endIndex + 1;

    return {
      page: index + 1,
      label: `${startEpisodeNum}-${endEpisodeNum}`,
    };
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {seasons.length > 1 && (
        <div className="inline-flex flex-wrap gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-2 backdrop-blur-md sm:rounded-[2rem]">
          {seasons.map((season) => (
            <button
              key={season}
              type="button"
              onClick={() => {
                setActiveSeason(season);
                setActivePage(1);
              }}
              aria-pressed={activeSeason === season}
              className={`min-h-[44px] rounded-[1rem] px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 sm:px-6 sm:text-sm ${activeSeason === season ? "border border-amber-400/30 bg-amber-500 text-white shadow-[0_12px_36px_rgba(217,119,6,0.24)]" : "border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"}`}
            >
              第 {season} 季
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap gap-2 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-2.5">
          {pageRanges.map((range) => (
            <button
              key={range.page}
              type="button"
              onClick={() => setActivePage(range.page)}
              aria-pressed={clampedPage === range.page}
              className={`min-h-[38px] rounded-lg border px-3 text-xs font-black tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${clampedPage === range.page ? "border-amber-400/40 bg-amber-500 text-white shadow-[0_10px_26px_rgba(217,119,6,0.24)]" : "border-white/10 bg-transparent text-slate-400 hover:border-white/20 hover:text-white"}`}
            >
              {range.label}
            </button>
          ))}
        </div>
      )}

      <motion.div
        layout
        className="grid grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4 md:grid-cols-8 lg:grid-cols-10"
      >
        <AnimatePresence mode="popLayout">
          {pagedEpisodes.map((episode) => (
            <motion.button
              key={episode.id}
              type="button"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => router.push(`/play/${seriesId}/${episode.id}`)}
              className="flex min-h-[44px] aspect-[5/3] items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/[0.03] text-base font-black text-slate-300 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 sm:rounded-[1.5rem] sm:text-lg"
            >
              {episode.episodeNum}
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
