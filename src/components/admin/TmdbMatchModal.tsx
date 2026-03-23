"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchWithCsrf } from "@/lib/fetch-client";

interface TmdbCandidate {
  tmdbId: number;
  title: string;
  type: "movie" | "tv";
  posterUrl: string | null;
  year: number | null;
  overview: string;
  voteAverage: number;
}

interface TmdbMatchModalProps {
  seriesId: number;
  seriesTitle: string;
  onClose: () => void;
  onMatched: (updated: {
    id: number;
    title: string;
    posterUrl: string | null;
    year: number | null;
  }) => void;
}

export default function TmdbMatchModal({
  seriesId,
  seriesTitle,
  onClose,
  onMatched,
}: TmdbMatchModalProps) {
  const [query, setQuery] = useState(seriesTitle);
  const [candidates, setCandidates] = useState<TmdbCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [binding, setBinding] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      return;
    }

    setSearching(true);
    setError("");
    setCandidates([]);

    try {
      const res = await fetch(
        `/api/admin/tmdb-search?q=${encodeURIComponent(query.trim())}`,
      );
      const data = await res.json();

      if (res.ok && data.candidates) {
        setCandidates(data.candidates);
        if (data.candidates.length === 0) {
          setError("没有找到匹配结果，请尝试其他关键词。");
        }
      } else {
        setError(data.error || "搜索失败。");
      }
    } catch {
      setError("网络请求失败。");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleBind = useCallback(
    async (candidate: TmdbCandidate) => {
      setBinding(candidate.tmdbId);
      setError("");

      try {
        const res = await fetchWithCsrf("/api/admin/enrich", {
          method: "POST",
          body: JSON.stringify({
            seriesId,
            tmdbId: candidate.tmdbId,
            type: candidate.type,
          }),
        });
        const data = await res.json();

        if (res.ok && data.updated) {
          onMatched(data.updated);
        } else {
          setError(data.error || "绑定失败。");
        }
      } catch {
        setError("网络请求失败。");
      } finally {
        setBinding(null);
      }
    },
    [seriesId, onMatched],
  );

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex h-full w-full items-start justify-center overflow-y-auto px-4 py-6 sm:py-10">
        <div
          className="w-full max-w-3xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex max-h-[min(80vh,720px)] flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-[#0b1020]/95 p-5 shadow-4xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  TMDB Match
                </p>
                <h3 className="text-xl font-black tracking-tight text-white">
                  手动匹配 TMDB 条目
                </h3>
                <p className="text-sm text-slate-400">
                  搜索更准确的候选项，再把当前条目绑定到正确的 TMDB 记录。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                aria-label="关闭弹窗"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                placeholder="输入影视名称搜索..."
                className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-amber-400/40 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="btn-primary min-h-[44px] justify-center px-6 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searching ? "搜索中..." : "搜索"}
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {candidates.map((candidate) => (
                <article
                  key={`${candidate.type}-${candidate.tmdbId}`}
                  className="flex gap-4 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <div
                    className="h-[90px] w-[60px] shrink-0 rounded-lg bg-cover bg-center bg-no-repeat"
                    style={{
                      backgroundImage: candidate.posterUrl
                        ? `url(${candidate.posterUrl})`
                        : undefined,
                      backgroundColor: candidate.posterUrl
                        ? undefined
                        : "rgba(255,255,255,0.04)",
                    }}
                  />

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-black text-white">
                        {candidate.title}
                      </h4>
                      <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        {candidate.type === "movie" ? "电影" : "剧集"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {candidate.year && <span>{candidate.year}</span>}
                      <span>TMDB #{candidate.tmdbId}</span>
                      <span>评分 {candidate.voteAverage}</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-slate-500">
                      {candidate.overview || "暂无简介"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => handleBind(candidate)}
                      disabled={binding !== null}
                      className="min-h-[40px] rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-bold text-emerald-300 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {binding === candidate.tmdbId ? "绑定中..." : "选定"}
                    </button>
                  </div>
                </article>
              ))}

              {!searching && candidates.length === 0 && !error && (
                <div className="flex min-h-[180px] items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-sm text-slate-500">
                  输入关键词后点击搜索，从 TMDB 候选项中挑选正确条目。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
