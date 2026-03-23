"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface EpisodeItem {
  id: number;
  episodeNum: number;
}

interface PlayEpisodePanelProps {
  seriesId: number;
  currentEpisodeId: number;
  allEpisodes: EpisodeItem[];
}

const EPISODES_PER_PAGE = 20;

export default function PlayEpisodePanel({
  seriesId,
  currentEpisodeId,
  allEpisodes,
}: PlayEpisodePanelProps) {
  const [episodePage, setEpisodePage] = useState(1);

  const totalEpisodePages = Math.max(
    1,
    Math.ceil(allEpisodes.length / EPISODES_PER_PAGE),
  );
  const currentEpisodePage = Math.min(episodePage, totalEpisodePages);
  const pageStart = (currentEpisodePage - 1) * EPISODES_PER_PAGE;
  const pagedEpisodes = allEpisodes.slice(
    pageStart,
    pageStart + EPISODES_PER_PAGE,
  );

  /** 分页标签范围（如 1-20, 21-36） */
  const episodePageRanges = useMemo(() => {
    return Array.from({ length: totalEpisodePages }, (_, index) => {
      const startIndex = index * EPISODES_PER_PAGE;
      const endIndex = Math.min(
        allEpisodes.length - 1,
        startIndex + EPISODES_PER_PAGE - 1,
      );
      const startEpisodeNum =
        allEpisodes[startIndex]?.episodeNum ?? startIndex + 1;
      const endEpisodeNum = allEpisodes[endIndex]?.episodeNum ?? endIndex + 1;

      return {
        page: index + 1,
        label: `${startEpisodeNum}-${endEpisodeNum}`,
      };
    });
  }, [allEpisodes, totalEpisodePages]);

  /** 自动定位到当前集所在的分页 */
  useEffect(() => {
    if (allEpisodes.length === 0) {
      queueMicrotask(() => setEpisodePage(1));
      return;
    }

    const currentEpisodeIndex = allEpisodes.findIndex(
      (item) => item.id === currentEpisodeId,
    );
    if (currentEpisodeIndex === -1) {
      queueMicrotask(() => setEpisodePage(1));
      return;
    }

    const nextPage = Math.floor(currentEpisodeIndex / EPISODES_PER_PAGE) + 1;
    queueMicrotask(() => setEpisodePage(nextPage));
  }, [allEpisodes, currentEpisodeId]);

  return (
    <div>
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-white tracking-widest">选集</h2>
        <span className="text-xs font-bold text-slate-500 bg-white/5 px-2.5 py-1 rounded">
          共 {allEpisodes.length} 集
        </span>
      </div>

      {/* 分页标签 */}
      {totalEpisodePages > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {episodePageRanges.map((range) => (
            <button
              key={range.page}
              onClick={() => setEpisodePage(range.page)}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                currentEpisodePage === range.page
                  ? "bg-white text-black"
                  : "bg-[#11131A] text-slate-400 hover:text-white hover:bg-[#1A1E29]"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      )}

      {/* 集数网格 */}
      <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 pb-6 max-h-[400px] lg:max-h-[65vh] overflow-y-auto scrollbar-thin pr-2">
        {pagedEpisodes.map((item) => {
          const isCurrent = item.id === currentEpisodeId;
          return (
            <Link
              key={item.id}
              href={`/play/${seriesId}/${item.id}`}
              scroll={false}
              className={`flex items-center justify-center py-2 text-xs font-black rounded-lg transition-all ${
                isCurrent
                  ? "bg-white text-black ring-1 ring-white"
                  : "bg-[#0F1117] text-slate-300 hover:bg-[#1A1D26] hover:text-white"
              }`}
            >
              {item.episodeNum}
            </Link>
          );
        })}
      </div>

      {/* 返回详情页 */}
      <div className="pt-6 mt-2 border-t border-white/5">
        <Link
          href={`/series/${seriesId}`}
          className="flex items-center justify-center w-full py-3.5 rounded-xl bg-[#0F1117] hover:bg-[#1A1D26] text-sm font-bold text-white transition-colors"
        >
          返回详情页
        </Link>
      </div>
    </div>
  );
}
