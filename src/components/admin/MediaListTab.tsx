"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TmdbMatchModal from "@/components/admin/TmdbMatchModal";
import EmptyStatePanel from "@/components/layout/EmptyStatePanel";
import { fetchWithCsrf } from "@/lib/fetch-client";

interface AdminMediaItem {
  id: number;
  title: string;
  type: string;
  posterUrl: string | null;
  episodeCount: number;
  year: number | null;
}

export default function MediaListTab() {
  const [mediaItems, setMediaItems] = useState<AdminMediaItem[]>([]);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [enrichingId, setEnrichingId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<{
    text: string;
    type: "success" | "error" | "";
  }>({ text: "", type: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [matchingItem, setMatchingItem] = useState<AdminMediaItem | null>(null);

  const showMsg = (text: string, type: "success" | "error") => {
    setActionMsg({ text, type });
    setTimeout(() => setActionMsg({ text: "", type: "" }), 3000);
  };

  const loadMediaItems = async () => {
    const res = await fetch("/api/series?limit=50");
    if (res.ok) {
      const data = await res.json();
      setMediaItems(data.items);
    }
    setMediaLoaded(true);
  };

  useEffect(() => {
    loadMediaItems().catch(console.error);
  }, []);

  const handleEnrich = async (seriesId: number) => {
    setEnrichingId(seriesId);
    try {
      const res = await fetchWithCsrf("/api/admin/enrich", {
        method: "POST",
        body: JSON.stringify({ seriesId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMediaItems((prev) =>
          prev.map((item) =>
            item.id === seriesId ? { ...item, ...data.updated } : item,
          ),
        );
        showMsg(`同步成功：${data.updated.title}`, "success");
      } else {
        showMsg(`同步失败：${data.error}`, "error");
      }
    } catch {
      showMsg("网络请求失败", "error");
    } finally {
      setEnrichingId(null);
    }
  };

  const handleDeleteMedia = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }

    setConfirmDeleteId(null);

    try {
      const res = await fetchWithCsrf(`/api/admin/media/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMediaItems((prev) => prev.filter((item) => item.id !== id));
        showMsg("媒体及关联记录已成功移除", "success");
      } else {
        showMsg("删除请求被拒绝", "error");
      }
    } catch {
      showMsg("网络请求失败", "error");
    }
  };

  const handleClearAll = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 3000);
      return;
    }

    setConfirmClearAll(false);
    const res = await fetchWithCsrf("/api/admin/media", {
      method: "DELETE",
      body: JSON.stringify({ confirm: "delete-all-resources" }),
    });

    if (res.ok) {
      setMediaItems([]);
      showMsg("媒体库已完全清空", "success");
    }
  };

  return (
    <div role="tabpanel" className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tight text-white">
            已落库媒体
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {actionMsg.text && (
            <div
              role="alert"
              className={`rounded-full border px-3 py-1 text-xs font-bold ${actionMsg.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}
            >
              {actionMsg.text}
            </div>
          )}

          <button
            type="button"
            onClick={handleClearAll}
            className={`min-h-[40px] rounded-xl border px-4 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${confirmClearAll ? "border-red-500 bg-red-500 text-white" : "border-red-500/20 bg-transparent text-red-300 hover:border-red-500/40 hover:bg-red-500/10"}`}
          >
            {confirmClearAll ? "确认清空？" : "清空全部"}
          </button>

          <button
            type="button"
            onClick={() => loadMediaItems().catch(console.error)}
            className="min-h-[40px] rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-white transition-all hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
          >
            立即刷新
          </button>
        </div>
      </div>

      {!mediaLoaded ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-amber-400" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Loading Media
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {mediaItems.map((item) => {
            const typeLabel =
              item.type === "movie"
                ? "电影"
                : item.type === "tv"
                  ? "剧集"
                  : "未知";
            const hasPoster = Boolean(item.posterUrl);

            return (
              <article
                key={item.id}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md"
              >
                <div className="flex gap-4">
                  <div
                    className="h-[132px] w-[88px] shrink-0 rounded-xl bg-cover bg-center bg-no-repeat"
                    style={{
                      backgroundImage: item.posterUrl
                        ? `url(${item.posterUrl})`
                        : undefined,
                      backgroundColor: item.posterUrl
                        ? undefined
                        : "rgba(255,255,255,0.04)",
                    }}
                  />

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-2">
                      <h3 className="truncate text-lg font-black tracking-tight text-white">
                        {item.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                        <span>{typeLabel}</span>
                        <span>·</span>
                        <span>{item.episodeCount} 集</span>
                        {item.year && (
                          <>
                            <span>·</span>
                            <span>{item.year}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${hasPoster ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}
                    >
                      {hasPoster ? "已补全资料" : "缺少元数据"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleEnrich(item.id)}
                    disabled={enrichingId === item.id}
                    className="btn-primary min-h-[40px] justify-center px-4 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {enrichingId === item.id ? "同步中" : "TMDB 重刷"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMatchingItem(item);
                    }}
                    className="min-h-[40px] rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 text-xs font-bold text-amber-300 transition-all hover:border-amber-400/40 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                  >
                    手动匹配
                  </button>

                  <Link
                    href={`/series/${item.id}`}
                    className="min-h-[40px] rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-white transition-all hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 inline-flex items-center"
                  >
                    详情
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDeleteMedia(item.id)}
                    className={`min-h-[40px] rounded-xl border px-4 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${confirmDeleteId === item.id ? "border-red-500 bg-red-500 text-white" : "border-red-500/30 bg-red-500/5 text-red-300 hover:border-red-500/40 hover:bg-red-500/10"}`}
                  >
                    {confirmDeleteId === item.id ? "确认下架？" : "下架"}
                  </button>
                </div>
              </article>
            );
          })}

          {mediaItems.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyStatePanel
                title="还没有已落库媒体"
                description="暂无媒体条目。"
              />
            </div>
          )}
        </div>
      )}

      {matchingItem && (
        <TmdbMatchModal
          seriesId={matchingItem.id}
          seriesTitle={matchingItem.title}
          onClose={() => {
            setMatchingItem(null);
          }}
          onMatched={(updated) => {
            setMediaItems((prev) =>
              prev.map((item) =>
                item.id === updated.id ? { ...item, ...updated } : item,
              ),
            );
            showMsg(`手动匹配成功：${updated.title}`, "success");
            setMatchingItem(null);
          }}
        />
      )}
    </div>
  );
}
