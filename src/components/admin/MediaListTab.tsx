"use client";
import { useState, useEffect } from "react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import Link from "next/link";

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
    const [actionMsg, setActionMsg] = useState<{ text: string; type: "success" | "error" | "" }>({ text: "", type: "" });
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [confirmClearAll, setConfirmClearAll] = useState(false);

    const showMsg = (text: string, type: "success" | "error") => {
        setActionMsg({ text, type });
        setTimeout(() => setActionMsg({ text: "", type: "" }), 3000);
    };

    const loadMediaItems = async () => {
        const res = await fetch("/api/series?limit=50");
        if (res.ok) {
            const data = await res.json();
            setMediaItems(data.items);
            setMediaLoaded(true);
        }
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
                setMediaItems((prev) => prev.map((it) => it.id === seriesId ? { ...it, ...data.updated } : it));
                showMsg(`同步成功：${data.updated.title}`, "success");
            } else {
                showMsg(`失败：${data.error}`, "error");
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
                setMediaItems(prev => prev.filter(m => m.id !== id));
                showMsg("影视及关联记录成功释放", "success");
            } else {
                showMsg("删除请求受阻", "error");
            }
        } catch {
            showMsg("网络层面中断", "error");
        }
    };

    return (
        <div role="tabpanel" className="fade-in-up" style={{ width: "100%" }}>
            <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>最近导入的剧集</h2>
                    {actionMsg.text && (
                        <div className="fade-in-up" style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "999px",
                            fontSize: "0.8125rem",
                            background: actionMsg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            color: actionMsg.type === "success" ? "#4ade80" : "#f87171",
                            border: `1px solid ${actionMsg.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`
                        }}>
                            {actionMsg.text}
                        </div>
                    )}
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                        onClick={async () => {
                            if (!confirmClearAll) {
                                setConfirmClearAll(true);
                                setTimeout(() => setConfirmClearAll(false), 3000);
                                return;
                            }
                            setConfirmClearAll(false);
                            const res = await fetchWithCsrf("/api/admin/media", {
                                method: "DELETE",
                                body: JSON.stringify({ confirm: "delete-all-resources" })
                            });
                            if (res.ok) {
                                setMediaItems([]);
                                showMsg("影视库已完全清空", "success");
                            }
                        }}
                        className="btn-ghost"
                        style={{
                            padding: "0.375rem 0.75rem",
                            fontSize: "0.8125rem",
                            color: confirmClearAll ? "#fff" : "#f87171",
                            background: confirmClearAll ? "#f87171" : "transparent",
                            border: confirmClearAll ? "1px solid #f87171" : "1px solid rgba(239,68,68,0.2)",
                            transition: "all 0.2s ease"
                        }}
                    >
                        {confirmClearAll ? '确认清空?' : '清空所有导入'}
                    </button>
                    <button onClick={() => loadMediaItems()} className="btn-ghost" style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}>
                        立即刷新
                    </button>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
                {mediaItems.map((item) => (
                    <div key={item.id} className="glass" style={{ display: "flex", flexDirection: "column", padding: "1.25rem", borderRadius: "0.875rem" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flex: 1 }}>
                            <div
                                style={{
                                    width: "60px",
                                    aspectRatio: "2/3",
                                    borderRadius: "0.375rem",
                                    background: item.posterUrl ? `url(${item.posterUrl}) center/cover` : "var(--color-surface)",
                                    flexShrink: 0,
                                }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "0.25rem" }}>
                                    {item.title}
                                </h3>
                                <div style={{ color: "var(--color-muted)", fontSize: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                                    <span>{item.type === "movie" ? "电影" : item.type === "tv" ? "剧集" : "未知"}</span>
                                    <span>•</span>
                                    <span>{item.episodeCount} 集</span>
                                    {item.year && <><span>•</span><span>{item.year}</span></>}
                                </div>
                                <span style={{
                                    display: "inline-block",
                                    fontSize: "0.7rem",
                                    padding: "0.1rem 0.4rem",
                                    borderRadius: "4px",
                                    border: "1px solid",
                                    ...(item.posterUrl
                                        ? { color: "#4ade80", background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)" }
                                        : { color: "#f87171", background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" }
                                    )
                                }}>
                                    {item.posterUrl ? "已刮削" : "缺元数据"}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                            <button
                                onClick={() => handleEnrich(item.id)}
                                disabled={enrichingId === item.id}
                                className="btn-primary"
                                style={{ flex: 1, padding: "0.5rem", fontSize: "0.8125rem", justifyContent: "center" }}
                            >
                                {enrichingId === item.id ? "同步中" : "TMDB重刷"}
                            </button>
                            <Link href={`/series/${item.id}`} className="btn-ghost" style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem" }}>
                                点播
                            </Link>
                            <button
                                onClick={() => handleDeleteMedia(item.id)}
                                className="btn-ghost"
                                style={{
                                    color: confirmDeleteId === item.id ? "#fff" : "#f87171", border: confirmDeleteId === item.id ? "1px solid #f87171" : "1px solid rgba(239,68,68,0.3)", background: confirmDeleteId === item.id ? "#f87171" : "rgba(239,68,68,0.05)", transition: "all 0.2s"
                                }}
                            >
                                {confirmDeleteId === item.id ? '确认下架?' : '下架'}
                            </button>
                        </div>
                    </div>
                ))}
                {mediaItems.length === 0 && mediaLoaded && (
                    <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>暂无落库多媒体内容，请到邻侧菜单扫描导入。</p>
                )}
            </div>
        </div>
    );
}
