"use client";

import { memo } from "react";
import FavoriteButton from "@/components/ui/FavoriteButton";

interface TmdbMeta {
  statusLabel?: string;
  runtime?: number;
}

interface PlayMetaHeaderProps {
  seriesId: number;
  seriesTitle: string;
  episodeNum: number;
  voteAverage?: number;
  year?: number | null;
  genres: string[];
  tmdbMeta: TmdbMeta;
}

function PlayMetaHeader({
  seriesId,
  seriesTitle,
  episodeNum,
  voteAverage,
  year,
  genres,
  tmdbMeta,
}: PlayMetaHeaderProps) {
  return (
    <header className="space-y-6 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 sm:gap-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
          {seriesTitle}
        </h1>

        {/* 移动端的收藏和集数组合在一行 */}
        <div className="flex sm:hidden items-center gap-3">
          <FavoriteButton seriesId={seriesId} />
          <span className="text-white bg-white/10 px-3 py-1 rounded-md text-xs font-bold">
            第 {episodeNum} 集
          </span>
        </div>

        {/* 桌面端的纯收藏按钮 */}
        <div className="hidden sm:block shrink-0 pb-1">
          <FavoriteButton seriesId={seriesId} />
        </div>
      </div>

      {/* 移动端的流媒体元数据网格 */}
      <div className="grid sm:hidden grid-cols-2 gap-y-3 gap-x-4 border-t border-white/5 pt-5 text-sm font-bold text-slate-400">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            评分 / TMDb
          </span>
          <span className="text-white">
            {voteAverage ? voteAverage.toFixed(1) : "暂无"}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            状态 / Status
          </span>
          <span
            className={
              tmdbMeta.statusLabel === "已完结"
                ? "text-green-500"
                : "text-amber-400"
            }
          >
            {tmdbMeta.statusLabel || "连载中"}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            发行 / Year
          </span>
          <span className="text-white">{year || "未知"}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            时长 / Runtime
          </span>
          <span className="text-white">
            {tmdbMeta.runtime ? `${tmdbMeta.runtime} 分钟` : "N/A"}
          </span>
        </div>
      </div>

      {/* 桌面端的流媒体元数据条 */}
      <div className="hidden sm:flex flex-wrap items-center gap-2.5 text-xs font-bold text-slate-400">
        <span className="text-white bg-white/10 px-2.5 py-1 rounded">
          第 {episodeNum} 集
        </span>
        {voteAverage ? (
          <span className="flex items-center gap-1">
            <span className="text-amber-500">TMDb</span>
            <span className="text-white">{voteAverage.toFixed(1)}</span>
          </span>
        ) : null}
        {tmdbMeta.statusLabel && (
          <span
            className={
              tmdbMeta.statusLabel === "已完结"
                ? "text-green-500"
                : "text-amber-400"
            }
          >
            {tmdbMeta.statusLabel}
          </span>
        )}
        <span>{year || "未知年份"}</span>
        {tmdbMeta.runtime ? <span>{tmdbMeta.runtime} 分钟</span> : null}
      </div>

      {/* 统一的类型标签列 */}
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 sm:pt-1">
          {genres.map((genre) => (
            <span
              key={genre}
              className="px-3 py-1.5 bg-white/5 sm:bg-[#11131A] text-slate-300 text-[11px] font-bold tracking-wide rounded border border-white/5"
            >
              {genre}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

export default memo(PlayMetaHeader);
