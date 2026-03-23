"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import EmptyStatePanel from "@/components/layout/EmptyStatePanel";
import PageHero from "@/components/layout/PageHero";
import PageLayout from "@/components/layout/PageLayout";
import SectionHeading from "@/components/layout/SectionHeading";
import StaggeredList from "@/components/layout/StaggeredList";
import MediaCard from "@/components/media-card/MediaCard";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          throw new Error(`Search failed with status: ${res.status}`);
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("API returned non-JSON response");
        }

        const data = await res.json();
        setResults(data.items || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const hasQuery = query.trim().length > 0;

  return (
    <PageLayout immersive={false} className="w-full !px-0">
      <div className="space-y-10 py-0 pb-12 sm:space-y-14 sm:pb-20">
        <PageHero
          align="center"
          eyebrow="Search"
          title={
            <>
              全站 <span className="text-blue-500 text-gradient">搜索</span>
            </>
          }
          footer={
            <div className="relative group rounded-full border border-white/10 bg-white/[0.02] p-1.5 sm:p-2 transition-colors focus-within:border-white/30 focus-within:bg-white/[0.04]">
              <input
                type="text"
                placeholder="搜索影视、导演、演员..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="font-outfit min-h-[56px] w-full bg-transparent px-6 py-4 text-lg font-black text-white placeholder:text-slate-600 focus:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 !shadow-none outline-none transition-all duration-700 sm:px-10 sm:py-6 sm:text-3xl"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 sm:right-8">
                {loading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-white/20 border-t-white sm:h-8 sm:w-8" />
                ) : (
                  <svg
                    className="h-6 w-6 text-slate-600 transition-colors group-hover:text-white sm:h-8 sm:w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>
            </div>
          }
        />

        <AnimatePresence mode="wait">
          {hasQuery && !loading && results.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <EmptyStatePanel
                title="没有找到匹配内容"
                description="暂无匹配结果。"
                actionHref="/library/videos"
                actionLabel="前往影视库"
              />
            </motion.div>
          ) : (
            <div
              key="results"
              className="w-full px-[4vw] space-y-8 sm:space-y-10"
            >
              {results.length > 0 && (
                <SectionHeading title={<>搜索结果（{results.length}）</>} />
              )}

              {results.length > 0 && (
                <StaggeredList className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4 xl:grid-cols-5">
                  {results.map((item) => (
                    <MediaCard key={item.id} {...item} />
                  ))}
                </StaggeredList>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageLayout>
  );
}
