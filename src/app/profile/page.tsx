"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import Link from "next/link";

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [favoritesCount, setFavoritesCount] = useState(0);
    const [historyCount, setHistoryCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // 并行请求所有数据
                const [meRes, favRes, histRes] = await Promise.all([
                    fetch("/api/auth/me"),
                    fetch("/api/user/favorites"),
                    fetch("/api/user/watch-history")
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
        if (!confirm("确定要退出登录吗？")) return;
        try {
            const res = await fetch("/api/auth/logout", { method: "POST" });
            if (res.ok) {
                localStorage.removeItem("access_token");
                window.location.href = "/login";
            }
        } catch (err) {
            console.error("退出失败:", err);
        }
    };

    if (loading) return <div className="min-h-screen bg-[#010204]" />;

    return (
        <PageLayout maxWidth="1200px">
            <div className="space-y-12 py-12 max-w-4xl mx-auto">
                <header className="relative py-20 px-12 glass rounded-[4rem] overflow-hidden border-blue-500/10 bg-gradient-to-br from-blue-600/5 via-transparent to-transparent">
                    <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                        <div className="w-32 h-32 rounded-full glass border-2 border-blue-500/30 flex items-center justify-center text-5xl font-black text-blue-500 italic shadow-2xl">
                            {user?.email?.[0].toUpperCase() || "U"}
                        </div>
                        <div>
                            <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-4">
                                个人 <span className="text-blue-500">中心</span>
                            </h1>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">
                                {user?.email || "离线用户模式"}
                            </p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Link href="/history" className="p-10 rounded-[3rem] glass glass-hover group">
                        <div className="flex flex-col h-full justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4">观影足迹</h3>
                                    <p className="text-slate-500 text-sm font-medium">回看您的追剧历史记录</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-4xl font-black text-blue-500 italic leading-none">{historyCount}</span>
                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">次访问</span>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <span className="text-blue-500 font-black italic">查看详情 →</span>
                            </div>
                        </div>
                    </Link>

                    <div className="p-10 rounded-[3rem] glass group transition-all">
                        <div className="flex flex-col h-full justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4">我的收藏</h3>
                                    <p className="text-slate-500 text-sm font-medium">您正在追的内容更新提醒</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-4xl font-black text-indigo-500 italic leading-none">{favoritesCount}</span>
                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">部收藏内容</span>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <Link href="/library/videos" className="text-indigo-500 font-black italic">前往 影库 →</Link>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="p-10 rounded-[3rem] glass transition-all border-red-500/10 hover:bg-red-500/5 text-left group"
                    >
                        <div className="flex flex-col h-full justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4">安全控制</h3>
                                <p className="text-slate-500 text-sm font-medium">管理您的连接凭证与账户权限</p>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <span className="text-red-500/50 font-black italic group-hover:text-red-500 transition-colors">退出登录</span>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </PageLayout>
    );
}
