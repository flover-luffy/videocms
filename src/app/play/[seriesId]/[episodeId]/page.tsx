"use client";

import { use, useEffect, useMemo, useState } from "react";
import EmptyStatePanel from "@/components/layout/EmptyStatePanel";
import PageLayout from "@/components/layout/PageLayout";
import VideoPlayer from "@/components/player/VideoPlayerWrapper";
import PlayBreadcrumb from "@/components/play/PlayBreadcrumb";
import PlayMetaHeader from "@/components/play/PlayMetaHeader";
import PlaySynopsis from "@/components/play/PlaySynopsis";
import PlayCredits from "@/components/play/PlayCredits";
import PlayEpisodePanel from "@/components/play/PlayEpisodePanel";
import { normalizeJsonArray, parseTmdbMetadata } from "@/lib/utils";

interface SeriesInfo {
  id: number;
  title: string;
  overview?: string;
  voteAverage?: number;
  year?: number | null;
  genres?: unknown;
  cast?: unknown;
  posterUrl?: string;
  tmdbData?: unknown;
}

interface EpisodeItem {
  id: number;
  episodeNum: number;
  series?: SeriesInfo;
}

interface PlayData {
  episode: EpisodeItem;
  allEpisodes: EpisodeItem[];
}

export default function PlayPage({
  params,
}: {
  params: Promise<{ seriesId: string; episodeId: string }>;
}) {
  const { seriesId, episodeId } = use(params);
  const [data, setData] = useState<PlayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/play/page-data?seriesId=${seriesId}&episodeId=${episodeId}`,
        );

        if (!isMounted) {
          return;
        }

        if (response.ok) {
          const playData = await response.json();
          setData(playData);
        } else {
          setIsMissing(true);
        }
      } catch {
        if (isMounted) {
          setIsMissing(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [episodeId, seriesId]);

  const series = data?.episode?.series;
  const episode = data?.episode;
  const allEpisodes = data?.allEpisodes ?? [];

  const genres = useMemo(
    () => normalizeJsonArray(series?.genres),
    [series?.genres],
  );
  const cast = useMemo(() => normalizeJsonArray(series?.cast), [series?.cast]);
  const tmdbMeta = useMemo(
    () => parseTmdbMetadata(series?.tmdbData),
    [series?.tmdbData],
  );

  // ─── 加载骨架屏 ───
  if (loading) {
    return (
      <PageLayout immersive={true} maxWidth="100%" className="!px-0">
        <div className="w-full bg-[#030407] min-h-screen pt-[100px]">
          <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="flex flex-col gap-8">
              {/* 播放器骨架 */}
              <div className="w-full max-w-5xl mx-auto aspect-video rounded-xl sm:rounded-2xl bg-[#0F1117] border border-white/5 animate-pulse" />
              {/* 内容区骨架 */}
              <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                  <div className="h-10 w-2/3 rounded-xl bg-white/5 animate-pulse" />
                  <div className="h-4 w-1/3 rounded-full bg-white/5 animate-pulse" />
                  <div className="h-32 w-full rounded-xl bg-white/5 animate-pulse" />
                </div>
                <div className="space-y-6">
                  <div className="h-6 w-32 rounded-full bg-white/5 animate-pulse" />
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 15 }).map((_, index) => (
                      <div
                        key={index}
                        className="aspect-[2/1] rounded-lg bg-white/5 animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ─── 缺失/错误状态 ───
  if (isMissing || !data || !episode || !series) {
    return (
      <PageLayout immersive={false} maxWidth="1200px">
        <div className="py-10 sm:py-16">
          <EmptyStatePanel
            title="播放页暂时不可用"
            description="当前剧集数据不可用。"
            actionHref={series ? `/series/${series.id}` : "/library/videos"}
            actionLabel={series ? "返回详情页" : "前往影视库"}
          />
        </div>
      </PageLayout>
    );
  }

  // ─── 正常渲染 ───
  return (
    <PageLayout immersive={true} maxWidth="100%" className="!px-0 bg-[#030407]">
      <div className="pt-[80px] sm:pt-[100px] pb-16 w-full">
        <div className="flex flex-col gap-0">
          {/* ① 播放器区域：使用与内容区一致的宽度约束 */}
          <section className="w-full max-w-[1400px] mx-auto px-0 sm:px-6 md:px-8">
            <div className="sm:rounded-2xl border-y sm:border border-white/5 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
              <VideoPlayer
                seriesId={String(series.id)}
                episodeId={String(episode.id)}
                playlist={allEpisodes.map((item) => ({
                  id: String(item.id),
                  episodeNumber: item.episodeNum,
                }))}
              />
            </div>
          </section>

          {/* 渐变分隔过渡 */}
          <div className="w-full max-w-[1400px] mx-auto px-8 sm:px-12 md:px-16 py-6 sm:py-8">
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* ② 内容区 */}
          <section className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 text-slate-300">
            {/* 面包屑 */}
            <PlayBreadcrumb
              seriesId={series.id}
              seriesTitle={series.title}
              episodeNum={episode.episodeNum}
            />

            {/* 双栏布局：增强间距与视觉层级 */}
            <div className="grid grid-cols-1 gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
              {/* 左侧：元数据信息流 */}
              <div className="order-2 lg:order-1 space-y-8">
                <PlayMetaHeader
                  seriesId={series.id}
                  seriesTitle={series.title}
                  episodeNum={episode.episodeNum}
                  voteAverage={series.voteAverage}
                  year={series.year}
                  genres={genres}
                  tmdbMeta={tmdbMeta}
                />

                <PlaySynopsis
                  overview={series.overview}
                  tagline={tmdbMeta.tagline}
                />

                <PlayCredits directors={tmdbMeta.directors} cast={cast} />
              </div>

              {/* 右侧：选集面板（卡片化容器） */}
              <div className="order-1 lg:order-2 lg:sticky lg:top-24">
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 sm:p-5">
                  <PlayEpisodePanel
                    seriesId={series.id}
                    currentEpisodeId={episode.id}
                    allEpisodes={allEpisodes}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
