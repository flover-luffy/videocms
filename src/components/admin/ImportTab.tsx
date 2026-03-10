"use client";
import { useState, useEffect } from "react";
import { fetchWithCsrf } from "@/lib/fetch-client";

interface Config {
    id: number;
    name: string;
    host: string;
}

interface ImportForm {
    configId: string;
    path: string;
    title: string;
}

const INPUT_STYLE: React.CSSProperties = {
    width: "100%",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.5rem",
    color: "var(--color-text)",
    padding: "0.625rem 0.875rem",
    fontSize: "0.9375rem",
    outline: "none",
    transition: "border-color 0.15s ease",
};

const LABEL_STYLE: React.CSSProperties = {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--color-muted)",
    marginBottom: "0.375rem",
};

const FIELD_STYLE: React.CSSProperties = {
    marginBottom: "1rem",
};

export default function ImportTab() {
    const [configs, setConfigs] = useState<Config[]>([]);
    const [importForm, setImportForm] = useState<ImportForm>({ configId: "", path: "", title: "" });
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<string>("");

    useEffect(() => {
        const loadConfigs = async () => {
            const res = await fetch("/api/admin/configs");
            if (res.ok) setConfigs(await res.json());
        };
        loadConfigs().catch(console.error);
    }, []);

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importForm.configId || !importForm.path) return;
        setImporting(true);
        setImportResult("");
        try {
            const res = await fetchWithCsrf("/api/admin/import", {
                method: "POST",
                body: JSON.stringify({
                    configId: parseInt(importForm.configId, 10),
                    path: importForm.path,
                    title: importForm.title || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                // 判断影视还是音乐
                if (data.newTracks !== undefined) {
                    setImportResult(`✓ 成功入库了 ${data.newTracks} 首音频！`);
                } else {
                    setImportResult(`✓ 成功！共导入 ${data.newEpisodes} 个记录。TMDB 元数据更新中……`);
                }
            } else {
                setImportResult(`✗ 失败：${data.error}`);
            }
        } catch {
            setImportResult("✗ 网络请求失败");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div role="tabpanel" className="glass fade-in-up" style={{ maxWidth: "560px", padding: "2rem", borderRadius: "1rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1.5rem" }}>导入 OpenList 目录或整轨专辑</h2>
            <form onSubmit={handleImport} noValidate>
                <div style={FIELD_STYLE}>
                    <label htmlFor="configId" style={LABEL_STYLE}>OpenList 连接 *</label>
                    <select
                        id="configId"
                        required
                        style={{ ...INPUT_STYLE, cursor: "pointer" }}
                        value={importForm.configId}
                        onChange={(e) => setImportForm((p) => ({ ...p, configId: e.target.value }))}
                    >
                        <option value="">请选择连接</option>
                        {configs.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.host})</option>
                        ))}
                    </select>
                    {configs.length === 0 && (
                        <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.375rem" }}>
                            尚无连接，请先在「连接配置」中添加。
                        </p>
                    )}
                </div>

                <div style={FIELD_STYLE}>
                    <label htmlFor="import-path" style={LABEL_STYLE}>OpenList 提取路径 *</label>
                    <input
                        id="import-path"
                        type="text"
                        required
                        placeholder="/video/2024/或独立音乐/专辑"
                        style={INPUT_STYLE}
                        value={importForm.path}
                        onChange={(e) => setImportForm((p) => ({ ...p, path: e.target.value }))}
                        aria-describedby="path-hint"
                    />
                    <p id="path-hint" style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.375rem" }}>
                        会自动探测目录下是否有音频格式并转入音乐源处理
                    </p>
                </div>

                <div style={FIELD_STYLE}>
                    <label htmlFor="import-title" style={LABEL_STYLE}>剧集或专辑名称（可选设定）</label>
                    <input
                        id="import-title"
                        type="text"
                        placeholder="留空则使用源目录名"
                        style={INPUT_STYLE}
                        value={importForm.title}
                        onChange={(e) => setImportForm((p) => ({ ...p, title: e.target.value }))}
                    />
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={importing}
                    style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }}
                    aria-busy={importing}
                >
                    {importing ? (
                        <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true" style={{ animation: "spin 1s linear infinite" }}>
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                            </svg>
                            正在广域扫描录入…
                        </>
                    ) : "开始推算入库"}
                </button>

                {importResult && (
                    <div
                        role="alert"
                        style={{
                            marginTop: "1rem",
                            padding: "0.75rem 1rem",
                            borderRadius: "0.5rem",
                            background: importResult.startsWith("✓") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            border: `1px solid ${importResult.startsWith("✓") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                            color: importResult.startsWith("✓") ? "#4ade80" : "#f87171",
                            fontSize: "0.875rem",
                            lineHeight: 1.5,
                        }}
                    >
                        {importResult}
                    </div>
                )}
            </form>
        </div>
    );
}
