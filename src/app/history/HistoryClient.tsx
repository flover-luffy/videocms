"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import EmptyStatePanel from "@/components/layout/EmptyStatePanel";
import PageHero from "@/components/layout/PageHero";
import PageLayout from "@/components/layout/PageLayout";
import SectionHeading from "@/components/layout/SectionHeading";
import StaggeredList from "@/components/layout/StaggeredList";

interface HistoryRecord {
  id: number;
  episodeId: number;
  position: number;
  duration: number | null;
  updatedAt: string;
  episode: {
    id: number;
    episodeNum: number;
    seasonNum: number | null;
    title: string | null;
    series: {
      id: number;
      title: string;
      posterUrl: string | null;
      backdropUrl?: string | null;
    };
  };
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/user/watch-history", {
          signal: controller.signal,
        });
        const data = await res.json();
        setHistory(data.history || []);
      } catch (err) {
        if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    return () => controller.abort();
  }, []);

  return (
    <PageLayout maxWidth="1600px">
      <div className="space-y-10 py-8 sm:space-y-14 sm:py-12">
        <PageHero
          eyebrow="Watch History"
          title={
            <>
              最近 <span className="text-blue-500 text-gradient">观看</span>
            </>
          }
          trailing={
            <div className="rounded-[2rem] border border-white/10 bg-black/25 px-6 py-5 text-right backdrop-blur-sm">
              <span className="block text-3xl font-black italic text-white sm:text-4xl">
                {history.length}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                History Items
              </span>
            </div>
          }
        />

        {loading ? (
          <div className="flex flex-col items-center gap-6 py-24 sm:py-40">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
            <p className="animate-pulse text-[10px] font-bold uppercase tracking-widest text-slate-500">
              正在加载观看记录
            </p>
          </div>
        ) : history.length === 0 ? (
          <EmptyStatePanel
            title="还没有观看记录"
            description="暂无观看记录。"
            actionHref="/"
            actionLabel="前往首页"
          />
        ) : (
          <div className="space-y-8 sm:space-y-10">
            <SectionHeading title={<>播放记录</>} />

            <StaggeredList className="grid grid-cols-1 gap-4 sm:gap-6">
              {history.map((record) => {
                const episode = record.episode;
                const series = episode?.series;

                if (!episode || !series) return null;

                const progress = record.duration
                  ? Math.min((record.position / record.duration) * 100, 100)
                  : 0;

                return (
                  <Link
                    key={record.id}
                    href={`/play/${series.id}/${episode.id}`}
                    className="group relative grid gap-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 transition-all duration-500 hover:border-blue-500/30 hover:bg-white/[0.05] sm:rounded-[2.5rem] sm:p-6 md:grid-cols-[18rem_1fr_auto]"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-[1.5rem]">
                      <Image
                        src={series.backdropUrl || series.posterUrl || ""}
                        alt={series.title}
                        fill
                        sizes="(min-width: 768px) 18rem, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col justify-center gap-4">
                      <div className="space-y-2">
                        <h3 className="truncate text-2xl font-black tracking-tighter text-white sm:text-3xl">
                          {series.title}
                        </h3>
                        <p className="text-sm font-medium text-slate-400">
                          第 {episode.episodeNum} 集
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-bold text-blue-200">
                          已观看 {Math.round(progress)}%
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          上次访问{" "}
                          {new Date(record.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center md:px-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white transition-colors duration-300 group-hover:border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white">
                        <svg
                          className="h-6 w-6"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </StaggeredList>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
