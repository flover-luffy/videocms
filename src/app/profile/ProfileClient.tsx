"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHero from "@/components/layout/PageHero";
import PageLayout from "@/components/layout/PageLayout";
import SectionHeading from "@/components/layout/SectionHeading";
import { fetchWithCsrf } from "@/lib/fetch-client";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [meRes, favRes, histRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/user/favorites"),
          fetch("/api/user/watch-history"),
        ]);

        if (meRes.ok) {
          const data = await meRes.json();
          setUser(data.user);
        }

        if (favRes.ok) {
          const data = await favRes.json();
          setFavoritesCount(data.items?.length || 0);
        }

        if (histRes.ok) {
          const data = await histRes.json();
          setHistoryCount(data.history?.length || 0);
        }
      } catch (err) {
        console.error("数据加载失败:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const handleLogout = async () => {
    if (!confirm("确定要退出登录吗？")) {
      return;
    }

    try {
      const res = await fetchWithCsrf("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        window.location.href = "/login";
      }
    } catch (err) {
      console.error("退出失败:", err);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#010204]" />;
  }

  return (
    <PageLayout maxWidth="1200px">
      <div className="mx-auto max-w-5xl space-y-10 py-8 sm:space-y-12 sm:py-12">
        <PageHero
          align="center"
          eyebrow="Profile"
          leading={
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-blue-500/30 bg-black/20 text-3xl font-black text-blue-400 shadow-2xl sm:h-32 sm:w-32 sm:text-5xl">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
          }
          title={
            <>
              个人 <span className="text-blue-500 text-gradient">中心</span>
            </>
          }
          description={user?.email}
          footer={
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/25 px-4 py-4 text-center backdrop-blur-sm">
                <span className="block text-2xl font-black text-white">
                  {historyCount}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  History
                </span>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/25 px-4 py-4 text-center backdrop-blur-sm">
                <span className="block text-2xl font-black text-white">
                  {favoritesCount}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Favorites
                </span>
              </div>
              {user?.role === "admin" && (
                <div className="rounded-[1.5rem] border border-blue-500/20 bg-blue-500/10 px-4 py-4 text-center backdrop-blur-sm">
                  <span className="block text-2xl font-black text-blue-200">
                    Admin
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/70">
                    Role
                  </span>
                </div>
              )}
            </div>
          }
        />

        <SectionHeading title={<>账号功能</>} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Link
            href="/history"
            className="group rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-blue-500/30 hover:bg-white/[0.05] sm:p-10"
          >
            <div className="flex h-full flex-col justify-between gap-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="mb-3 text-2xl font-black tracking-tighter text-white">
                    观看记录
                  </h3>
                </div>
                <span className="text-4xl font-black text-blue-400">
                  {historyCount}
                </span>
              </div>
              <span className="text-sm font-bold text-blue-300 transition-colors group-hover:text-blue-200">
                详情
              </span>
            </div>
          </Link>

          <Link
            href="/library/videos"
            className="group rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-indigo-500/30 hover:bg-white/[0.05] sm:p-10"
          >
            <div className="flex h-full flex-col justify-between gap-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="mb-3 text-2xl font-black tracking-tighter text-white">
                    我的收藏
                  </h3>
                </div>
                <span className="text-4xl font-black text-indigo-400">
                  {favoritesCount}
                </span>
              </div>
              <span className="text-sm font-bold text-indigo-300 transition-colors group-hover:text-indigo-200">
                打开影视库
              </span>
            </div>
          </Link>

          {user?.role === "admin" && (
            <Link
              href="/admin"
              className="group rounded-[2.5rem] border border-blue-500/20 bg-blue-500/5 p-6 transition-all duration-300 hover:border-blue-400/40 hover:bg-blue-500/10 sm:p-10"
            >
              <div className="flex h-full flex-col justify-between gap-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="mb-3 text-2xl font-black tracking-tighter text-white">
                      管理后台
                    </h3>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                </div>
                <span className="text-sm font-bold text-blue-300 transition-colors group-hover:text-blue-200">
                  进入后台
                </span>
              </div>
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="group rounded-[2.5rem] border border-red-500/10 bg-white/[0.03] p-6 text-left transition-all duration-300 hover:border-red-500/30 hover:bg-red-500/5 sm:p-10"
          >
            <div className="flex h-full flex-col justify-between gap-8">
              <div>
                <h3 className="mb-3 text-2xl font-black tracking-tighter text-white">
                  退出登录
                </h3>
              </div>
              <span className="text-sm font-bold text-red-400 transition-colors group-hover:text-red-300">
                立即退出
              </span>
            </div>
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
