"use client";

import Image from "next/image";
import Link from "next/link";
import EpisodeListClient from "@/components/series/EpisodeListClient";
import PageLayout from "@/components/layout/PageLayout";
import SectionHeading from "@/components/layout/SectionHeading";
import FavoriteButton from "@/components/ui/FavoriteButton";
import { normalizeJsonArray, parseTmdbMetadata } from "@/lib/utils";

interface SeriesEpisode {
  id: number;
  episodeNum: number;
  seasonNum: number | null;
  title?: string | null;
}

interface SeriesDetailData {
  id: number;
  title: string;
  overview: string | null;
  backdropUrl: string | null;
  posterUrl: string | null;
  voteAverage: number | null;
  year: number | null;
  genres: unknown;
  cast: unknown;
  tmdbData: unknown;
  episodes: SeriesEpisode[];
}

export default function SeriesDetailDesktop({
  series,
}: {
  series: SeriesDetailData;
}) {
  const genres = normalizeJsonArray(series.genres);
  const cast = normalizeJsonArray(series.cast);
  const tmdbMeta = parseTmdbMetadata(series.tmdbData);
  const firstEpisode = series.episodes[0];

  return (
    <PageLayout immersive className="!px-0" maxWidth="100%">
      {/* Hero Section */}
      <div className="relative h-[70vh] w-full overflow-hidden">
        {series.backdropUrl && (
          <Image
            src={series.backdropUrl}
            alt={series.title}
            fill
            sizes="100vw"
            priority
            className="object-cover object-top opacity-40 transition-opacity duration-1000"
            suppressHydrationWarning
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#010204] via-[#010204]/70 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1700px] items-end gap-12 px-8 pb-16">
          <div className="group relative aspect-[2/3] w-64 shrink-0 overflow-hidden rounded-[2.5rem] shadow-[0_0_40px_rgba(0,0,0,0.8)]">
            {series.posterUrl && (
              <Image
                src={series.posterUrl}
                alt={series.title}
                fill
                sizes="16rem"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                suppressHydrationWarning
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] ring-1 ring-inset ring-white/10" />
          </div>

          <div className="relative z-10 flex-1 space-y-6 pb-4">
            <div className="flex items-center gap-3">
              {series.voteAverage && (
                <div className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-4 py-1.5 backdrop-blur-md border border-blue-500/20">
                  <span className="text-[10px] font-black italic text-blue-400">
                    TMDb
                  </span>
                  <span className="text-sm font-black text-white">
                    {series.voteAverage.toFixed(1)}
                  </span>
                </div>
              )}
              <span className="rounded-full bg-white/5 border border-white/5 px-4 py-1.5 text-xs font-bold tracking-widest text-slate-300 backdrop-blur-md">
                {series.year || "2024"}
              </span>
              <span className="rounded-full bg-white/5 border border-white/5 px-4 py-1.5 text-xs font-bold tracking-widest text-slate-300 backdrop-blur-md">
                {series.episodes.length} EPISODES
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white drop-shadow-2xl">
              {series.title}
            </h1>

            <div className="flex items-center gap-4">
              {firstEpisode ? (
                <Link
                  href={`/play/${series.id}/${firstEpisode.id}`}
                  className="inline-flex h-14 items-center justify-center rounded-full bg-white px-10 text-sm font-bold text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-105 hover:bg-slate-200"
                >
                  立即播放
                </Link>
              ) : null}
              <FavoriteButton seriesId={series.id} />
            </div>

            <div className="flex flex-wrap gap-2">
              {genres.map((genre: string) => (
                <span
                  key={genre}
                  className="rounded-full bg-white/[0.03] border border-white/[0.05] px-4 py-1.5 text-xs font-bold tracking-wide text-slate-400 backdrop-blur-md"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="mx-auto grid max-w-[1700px] grid-cols-1 gap-16 px-8 py-16 pb-40 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
        <div className="space-y-20 min-w-0">
          <div className="space-y-8">
            <SectionHeading title={<>剧情简介</>} />
            {tmdbMeta.tagline && (
              <blockquote className="border-l-4 border-blue-500/50 bg-blue-500/[0.02] py-3 pl-5 pr-4 italic text-blue-200/90 font-medium text-lg rounded-r-2xl">
                &quot;{tmdbMeta.tagline}&quot;
              </blockquote>
            )}
            <p className="text-lg font-medium leading-relaxed tracking-wide text-slate-300/80">
              {series.overview}
            </p>
          </div>

          <div className="space-y-8 min-w-0">
            <SectionHeading
              title={<>选集列表</>}
              action={
                <span className="inline-flex rounded-full border border-white/5 bg-white/[0.02] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {series.episodes.length} Episodes
                </span>
              }
            />
            <div className="rounded-[2rem] bg-black/20 p-4 border border-white/[0.02]">
              <EpisodeListClient
                seriesId={series.id}
                episodes={series.episodes}
              />
            </div>
          </div>
        </div>

        <aside className="w-full lg:sticky lg:top-24 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-hide">
          <div className="rounded-[2.5rem] bg-[#0A0C12]/90 p-8 border border-white/[0.03] backdrop-blur-xl shadow-2xl">
            <SectionHeading
              title={
                <span className="text-sm font-black tracking-widest text-slate-300 uppercase">
                  影片信息
                </span>
              }
              className="mb-8 border-b border-white/[0.04] pb-5"
            />
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                {tmdbMeta.statusLabel && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      状态
                    </span>
                    <span
                      className={`text-sm font-black ${tmdbMeta.statusLabel === "已完结" ? "text-green-400" : "text-blue-400"}`}
                    >
                      {tmdbMeta.statusLabel}
                    </span>
                  </div>
                )}
                {tmdbMeta.releaseDate && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      首波放映
                    </span>
                    <span className="text-sm font-semibold text-slate-300">
                      {tmdbMeta.releaseDate}
                    </span>
                  </div>
                )}
                {tmdbMeta.runtime !== undefined && tmdbMeta.runtime > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      单集时长
                    </span>
                    <span className="text-sm font-semibold text-slate-300">
                      {tmdbMeta.runtime} MIN
                    </span>
                  </div>
                )}
              </div>
              {cast.length > 0 && (
                <div className="pt-6 border-t border-white/[0.04]">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                    主要演员
                  </span>
                  <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-2">
                    {cast.map((person: string) => (
                      <span
                        key={person}
                        className="rounded-md bg-white/[0.02] border border-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-slate-400"
                      >
                        {person}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </PageLayout>
  );
}
