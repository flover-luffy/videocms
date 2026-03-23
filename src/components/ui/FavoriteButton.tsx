"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithCsrf } from "@/lib/fetch-client";

export default function FavoriteButton({ seriesId }: { seriesId: number }) {
  const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    const timer = window.setTimeout(() => setMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadFavorites = async () => {
      try {
        const res = await fetch("/api/user/favorites", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setIsLoggedIn(false);
            setIsFavorite(false);
          }
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setIsLoggedIn(true);
          const found = data.items?.some(
            (item: { seriesId: number }) => item.seriesId === seriesId,
          );
          setIsFavorite(Boolean(found));
        }
      } catch (error) {
        console.error("[FavoriteButton] 获取收藏状态失败", error);
        if (!cancelled) {
          setIsLoggedIn(false);
          setIsFavorite(false);
        }
      }
    };

    loadFavorites().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const toggleFavorite = async () => {
    if (!isLoggedIn) {
      showMessage("登录后才能收藏内容");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithCsrf("/api/user/favorites", {
        method: "POST",
        body: JSON.stringify({ seriesId }),
      });
      const data = await res.json();
      if (res.ok && data.isFavorite !== undefined) {
        setIsFavorite(data.isFavorite);
        showMessage(data.isFavorite ? "已加入收藏" : "已取消收藏");
      } else {
        showMessage(data.error || "收藏状态更新失败");
      }
    } catch {
      showMessage("网络请求失败");
    } finally {
      setLoading(false);
    }
  };

  if (isFavorite === null) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold text-slate-500 opacity-60"
        >
          <span className="h-4 w-4 animate-pulse rounded-full bg-white/10" />
          检查收藏状态...
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={loading}
        aria-label={isFavorite ? "取消收藏" : "加入收藏"}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 disabled:cursor-not-allowed disabled:opacity-60 ${isFavorite ? "border-amber-500/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20" : "border-white/10 bg-white/[0.03] text-white hover:border-white/20 hover:bg-white/[0.06]"}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={isFavorite ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {loading ? "处理中..." : isFavorite ? "已收藏" : "加入收藏"}
      </button>

      {message && (
        <p role="status" className="text-xs font-medium text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
}
