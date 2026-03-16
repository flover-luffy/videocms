"use client";
import { useState, useEffect } from "react";
import { fetchWithCsrf } from "@/lib/fetch-client";

export default function FavoriteButton({ seriesId }: { seriesId: number }) {
    const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        // 检查是否登录（通过本地 token 判断最简单，也可以请求 /api/auth/me）
        const token = localStorage.getItem("access_token");
        if (!token) {
            setIsLoggedIn(false);
            return;
        }
        setIsLoggedIn(true);

        // 获取初始状态
        fetch("/api/user/favorites")
            .then((res) => res.json())
            .then((data) => {
                if (data.items) {
                    const found = data.items.some((f: { seriesId: number }) => f.seriesId === seriesId);
                    setIsFavorite(found);
                }
            })
            .catch((error) => {
                console.error("[FavoriteButton] 获取收藏状态失败:", error);
                // 失败时设置为未收藏状态
                setIsFavorite(false);
            });
    }, [seriesId]);

    const toggleFavorite = async () => {
        if (!isLoggedIn) {
            alert("请先登录后再使用收藏功能！");
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
            }
        } catch {
            alert("网络错误");
        } finally {
            setLoading(false);
        }
    };

    // 如果状态还在加载，不显示或者是 skeleton
    if (isFavorite === null && isLoggedIn) {
        return (
            <button disabled className="btn-ghost" style={{ padding: "0.4rem 0.75rem", fontSize: "0.875rem", opacity: 0.5 }}>
                检查收藏状态...
            </button>
        );
    }

    return (
        <button
            onClick={toggleFavorite}
            disabled={loading}
            className={isFavorite ? "btn-primary" : "btn-ghost"}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 0.875rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                transition: "all 0.2s",
                border: isFavorite ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
            }}
            aria-label={isFavorite ? "取消收藏" : "加入收藏"}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            {isFavorite ? "已追剧" : "追剧"}
        </button>
    );
}
