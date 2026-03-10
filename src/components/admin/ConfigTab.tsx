"use client";
import { useState, useEffect } from "react";
import { fetchWithCsrf } from "@/lib/fetch-client";

interface Config {
    id: number;
    name: string;
    host: string;
    token?: string; // Optional since it might not be returned by default GET
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

export default function ConfigTab() {
    const [configs, setConfigs] = useState<Config[]>([]);
    const [newConfig, setNewConfig] = useState({ name: "", host: "", token: "" });
    const [addingConfig, setAddingConfig] = useState(false);
    const [configMsg, setConfigMsg] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    // Editing State
    const [editingConfigId, setEditingConfigId] = useState<number | null>(null);
    const [editConfig, setEditConfig] = useState({ name: "", host: "", token: "" });
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        const loadConfigs = async () => {
            const res = await fetch("/api/admin/configs");
            if (res.ok) setConfigs(await res.json());
        };
        loadConfigs().catch(console.error);
    }, []);

    const handleAddConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newConfig.name || !newConfig.host || !newConfig.token) return;
        setAddingConfig(true);
        setConfigMsg("");
        try {
            const res = await fetchWithCsrf("/api/admin/configs", {
                method: "POST",
                body: JSON.stringify(newConfig),
            });
            const data = await res.json();
            if (res.ok) {
                setConfigs((prev) => [...prev, data]);
                setNewConfig({ name: "", host: "", token: "" });
                setConfigMsg("✓ 连接已添加");
            } else {
                setConfigMsg(`✗ ${data.error}`);
            }
        } catch {
            setConfigMsg("✗ 网络请求失败");
        } finally {
            setAddingConfig(false);
        }
    };

    const handleDeleteConfig = async (id: number) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            setTimeout(() => setConfirmDeleteId(null), 3000);
            return;
        }

        setConfirmDeleteId(null);
        try {
            const res = await fetchWithCsrf(`/api/admin/configs/${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (res.ok) {
                setConfigs(prev => prev.filter(c => c.id !== id));
                setConfigMsg("✓ 配置已移除");
            } else {
                alert(data.error || "删除失败");
            }
        } catch {
            alert("网络请求失败");
        }
    };

    const handleStartEdit = (c: Config) => {
        setEditingConfigId(c.id);
        setEditConfig({ name: c.name, host: c.host, token: "" });
    };

    const handleSaveEdit = async (id: number) => {
        if (!editConfig.name || !editConfig.host || !editConfig.token) {
            alert("信息不完整，请输入新的 Token。");
            return;
        }
        setSavingEdit(true);
        try {
            const res = await fetchWithCsrf(`/api/admin/configs/${id}`, {
                method: "PUT",
                body: JSON.stringify(editConfig),
            });
            const data = await res.json();
            if (res.ok) {
                setConfigs(prev => prev.map(c => c.id === id ? data : c));
                setEditingConfigId(null);
                setConfigMsg("✓ 配置已更新");
            } else {
                alert(data.error || "更新失败");
            }
        } catch {
            alert("网络请求失败");
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <div role="tabpanel" className="fade-in-up" style={{ maxWidth: "640px" }}>
            {configs.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>已配置的连接</h2>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {configs.map((c) => (
                            <div
                                key={c.id}
                                className="glass"
                                style={{ padding: "1rem 1.25rem", borderRadius: "0.75rem" }}
                            >
                                {editingConfigId === c.id ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                        <div>
                                            <input type="text" placeholder="连接名称" style={INPUT_STYLE} value={editConfig.name} onChange={e => setEditConfig(p => ({ ...p, name: e.target.value }))} />
                                        </div>
                                        <div>
                                            <input type="url" placeholder="OpenList 地址" style={INPUT_STYLE} value={editConfig.host} onChange={e => setEditConfig(p => ({ ...p, host: e.target.value }))} />
                                        </div>
                                        <div>
                                            <input type="password" placeholder="重新输入 Token" style={INPUT_STYLE} value={editConfig.token} onChange={e => setEditConfig(p => ({ ...p, token: e.target.value }))} />
                                        </div>
                                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", justifyContent: "flex-end" }}>
                                            <button className="btn-ghost" onClick={() => setEditingConfigId(null)} style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}>取消</button>
                                            <button className="btn-primary" onClick={() => handleSaveEdit(c.id)} disabled={savingEdit} style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}> {savingEdit ? "保存中" : "保存"} </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 600, marginBottom: "0.2rem" }}>{c.name}</p>
                                            <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>{c.host}</p>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <span style={{ fontSize: "0.75rem", color: "#4ade80", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", padding: "0.2rem 0.625rem", borderRadius: "999px" }}>
                                                已连接
                                            </span>
                                            <button
                                                onClick={() => handleStartEdit(c)}
                                                className="btn-ghost"
                                                style={{
                                                    padding: "0.25rem 0.5rem",
                                                    fontSize: "0.75rem",
                                                }}
                                            >
                                                编辑
                                            </button>
                                            <button
                                                onClick={() => handleDeleteConfig(c.id)}
                                                className="btn-ghost"
                                                style={{
                                                    color: confirmDeleteId === c.id ? "#fff" : "#f87171",
                                                    background: confirmDeleteId === c.id ? "#f87171" : "transparent",
                                                    padding: "0.25rem 0.5rem",
                                                    fontSize: "0.75rem",
                                                    border: confirmDeleteId === c.id ? "1px solid #f87171" : "1px solid rgba(239,68,68,0.2)",
                                                    transition: "all 0.2s ease"
                                                }}
                                            >
                                                {confirmDeleteId === c.id ? '确认删除?' : '删除'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="glass" style={{ padding: "2rem", borderRadius: "1rem" }}>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1.5rem" }}>添加新的 OpenList 连接</h2>
                <form onSubmit={handleAddConfig} noValidate>
                    <div style={FIELD_STYLE}>
                        <label htmlFor="config-name" style={LABEL_STYLE}>连接名称 *</label>
                        <input id="config-name" type="text" required placeholder="我的 OpenList" style={INPUT_STYLE}
                            value={newConfig.name} onChange={(e) => setNewConfig((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div style={FIELD_STYLE}>
                        <label htmlFor="config-host" style={LABEL_STYLE}>OpenList 地址 *</label>
                        <input id="config-host" type="url" required placeholder="https://your-openlist.com" style={INPUT_STYLE}
                            value={newConfig.host} onChange={(e) => setNewConfig((p) => ({ ...p, host: e.target.value }))} />
                    </div>
                    <div style={FIELD_STYLE}>
                        <label htmlFor="config-token" style={LABEL_STYLE}>访问 Token *</label>
                        <input id="config-token" type="password" required placeholder="OpenList 管理后台 → 用户设置 → Token" style={INPUT_STYLE}
                            value={newConfig.token} onChange={(e) => setNewConfig((p) => ({ ...p, token: e.target.value }))}
                            aria-describedby="token-hint" />
                        <p id="token-hint" style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.375rem" }}>
                            在 OpenList 管理后台 → 设置 → 用户 中复制 Token
                        </p>
                    </div>
                    <button type="submit" className="btn-primary" disabled={addingConfig}
                        style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }} aria-busy={addingConfig}>
                        {addingConfig ? "验证连接中…" : "添加连接"}
                    </button>
                    {configMsg && (
                        <p role="alert" style={{ marginTop: "0.875rem", fontSize: "0.875rem", color: configMsg.startsWith("✓") ? "#4ade80" : "#f87171" }}>
                            {configMsg}
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}
