"use client";

import Image from "next/image";
import Link from "next/link";
import EpisodeListClient from "@/components/series/EpisodeListClient";
import PageLayout from "@/components/layout/PageLayout";
import SectionHeading from "@/components/layout/SectionHeading";
import FavoriteButton from "@/components/ui/FavoriteButton";
import { normalizeJsonArray, parseTmdbMetadata } from "@/lib/utils";

export default function SeriesDetailMobile({ series }: { series: unknown }) {
  const genres = normalizeJsonArray(series.genres);
  const tmdbMeta = parseTmdbMetadata(series.tmdbData);
  const firstEpisode = series.episodes[0];

  return (
    <PageLayout immersive className="!px-0" maxWidth="100%">
      {/* Mobile Hero: Portrait Focus */}
      <div className="relative h-[65vh] w-full overflow-hidden">
        {(series.posterUrl || series.backdropUrl) && (
          <Image
            src={series.posterUrl || series.backdropUrl}
            alt={series.title}
            fill
            priority
            className="object-cover object-top opacity-70"
            suppressHydrationWarning
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0C0A09] via-[#0C0A09]/60 to-transparent pt-safe" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-12 text-center space-y-6">
          {/* Metadata Badges */}
          <div className="flex flex-wrap justify-center gap-2">
            <span className="bg-white/10 text-white/90 text-[10px] font-black tracking-widest px-2.5 py-1 rounded backdrop-blur-md">
              {series.year || "2024"}
            </span>
            <span className="bg-white/10 text-white/90 text-[10px] font-black tracking-widest px-2.5 py-1 rounded backdrop-blur-md">
              {series.episodes.length} EPISODES
            </span>
            {tmdbMeta.statusLabel && (
              <span
                className={`text-[10px] font-black tracking-widest px-2.5 py-1 rounded backdrop-blur-md ${tmdbMeta.statusLabel === "已完结" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}`}
              >
                {tmdbMeta.statusLabel}
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white drop-shadow-lg leading-tight line-clamp-3 text-balance">
            {series.title}
          </h1>

          {/* Mobile Actions: Vertical Stack */}
          <div className="flex flex-col w-full gap-3 pt-2">
            {firstEpisode ? (
              <Link
                href={`/play/${series.id}/${firstEpisode.id}`}
                className="flex h-12 items-center justify-center rounded-xl bg-white text-sm font-black text-black active:scale-[0.98] transition-all shadow-xl"
              >
                立即播放
              </Link>
            ) : null}
            <FavoriteButton seriesId={series.id} />
          </div>
        </div>
      </div>

      {/* Mobile Content Body */}
      <div className="px-5 py-8 space-y-12 pb-32">
        {/* Synopsis */}
        <div className="space-y-4">
          <SectionHeading title="剧情简介" />
          <p className="text-sm font-medium leading-relaxed text-slate-300/90 italic">
            {tmdbMeta.tagline}
          </p>
          <p className="text-sm font-medium leading-relaxed text-slate-400 line-clamp-6">
            {series.overview}
          </p>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">
              发行 / Year
            </span>
            <span className="text-sm font-bold text-slate-300">
              {series.year || "未知"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">
              分类 / Genre
            </span>
            <span className="text-sm font-bold text-slate-300 truncate">
              {genres[0] || "剧情"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">
              时长 / Runtime
            </span>
            <span className="text-sm font-bold text-slate-300">
              {tmdbMeta.runtime ? `${tmdbMeta.runtime}m` : "N/A"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">
              评分 / Score
            </span>
            <span className="text-sm font-bold text-amber-500">
              {series.voteAverage ? series.voteAverage.toFixed(1) : "N/A"}
            </span>
          </div>
        </div>

        {/* Episode List */}
        <div className="space-y-6">
          <SectionHeading title="选集播放" />
          <div className="rounded-2xl bg-black/20 border border-white/5 overflow-hidden">
            <EpisodeListClient
              seriesId={series.id}
              episodes={series.episodes}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
