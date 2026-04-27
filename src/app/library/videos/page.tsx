"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import EmptyStatePanel from "@/components/layout/EmptyStatePanel";
import PageHero from "@/components/layout/PageHero";
import PageLayout from "@/components/layout/PageLayout";
import SectionHeading from "@/components/layout/SectionHeading";
import StaggeredList from "@/components/layout/StaggeredList";
import MediaCard, { type MediaCardProps } from "@/components/media-card/MediaCard";

type LibraryType = "movie" | "tv";

const FILTERS: Array<{ id: LibraryType; label: string }> = [
  {
    id: "movie",
    label: "电影",
  },
  {
    id: "tv",
    label: "剧集",
  },
];

export default function LibraryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchType = searchParams.get("type") === "tv" ? "tv" : "movie";

  const [items, setItems] = useState<MediaCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<LibraryType>(searchType);

  useEffect(() => {
    setType(searchType);
  }, [searchType]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/series?type=${type}&limit=48`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setItems(data.items || []);
      } catch (err) {
        const error = err as Error;
        if (controller.signal.aborted || error.name === "AbortError") {
          return;
        }
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => controller.abort();
  }, [type]);

  const activeFilter = useMemo(
    () => FILTERS.find((item) => item.id === type) || FILTERS[0],
    [type],
  );

  const handleTypeChange = (nextType: LibraryType) => {
    if (nextType === type) {
      return;
    }

    setType(nextType);
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", nextType);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <PageLayout immersive={false} className="w-full !px-0">
      <div className="space-y-10 py-0 pb-12 sm:space-y-14 sm:pb-20">
        <PageHero
          eyebrow="Library"
          title={
            <>
              影视 <span className="text-blue-500 text-gradient">库</span>
            </>
          }
          trailing={
            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/25 px-4 py-4 text-center backdrop-blur-sm">
                <span className="block text-2xl font-black text-white">
                  {items.length}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Visible
                </span>
              </div>
              <div className="rounded-[1.5rem] border border-blue-500/20 bg-blue-500/10 px-4 py-4 text-center backdrop-blur-sm">
                <span className="block text-lg font-black text-blue-200">
                  {activeFilter.label}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/70">
                  Current
                </span>
              </div>
            </div>
          }
          footer={
            <div className="space-y-4">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => handleTypeChange(filter.id)}
                    aria-pressed={type === filter.id}
                    className={`relative min-h-[48px] px-2 py-3 text-lg font-black transition-all focus-visible:outline-none sm:px-4 ${
                      type === filter.id
                        ? "text-white"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span className="relative z-10">{filter.label}</span>
                    {type === filter.id && (
                      <motion.div
                        layoutId="activeFilterBg"
                        className="absolute inset-x-0 bottom-1.5 h-1 bg-white"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-6 py-24 sm:py-40"
            >
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-500/20 border-t-white sm:h-16 sm:w-16" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                正在载入影视库数据
              </p>
            </motion.div>
          ) : items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <EmptyStatePanel
                title="暂时没有可显示的内容"
                description="当前筛选下暂无内容。"
                actionHref={`/library/videos?type=${type === "movie" ? "tv" : "movie"}`}
                actionLabel={`切换到${type === "movie" ? "剧集" : "电影"}`}
              />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-[4vw] space-y-8 sm:space-y-10"
            >
              <SectionHeading
                title={
                  <>
                    {activeFilter.label}列表（{items.length}）
                  </>
                }
              />

              <StaggeredList className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {items.map((item) => (
                  <MediaCard key={item.id} {...item} />
                ))}
              </StaggeredList>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageLayout>
  );
}
