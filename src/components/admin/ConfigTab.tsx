"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import EmptyStatePanel from "@/components/layout/EmptyStatePanel";
import { fetchWithCsrf } from "@/lib/fetch-client";

interface Config {
  id: number;
  name: string;
  host: string;
  token?: string;
}

interface ConfigFormState {
  name: string;
  host: string;
  token: string;
}

const EMPTY_FORM: ConfigFormState = {
  name: "",
  host: "",
  token: "",
};

export default function ConfigTab() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [newConfig, setNewConfig] = useState<ConfigFormState>(EMPTY_FORM);
  const [addingConfig, setAddingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<{
    text: string;
    type: "success" | "error" | "";
  }>({ text: "", type: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null);
  const [editConfig, setEditConfig] = useState<ConfigFormState>(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const res = await fetch("/api/admin/configs");
        if (res.ok) {
          setConfigs(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadConfigs().catch(console.error);
  }, []);

  const activeEditHost = useMemo(
    () => configs.find((config) => config.id === editingConfigId)?.host,
    [configs, editingConfigId],
  );

  const pushMsg = useCallback((text: string, type: "success" | "error") => {
    setConfigMsg({ text, type });
    setTimeout(() => setConfigMsg({ text: "", type: "" }), 3200);
  }, []);

  const handleAddConfig = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConfig.name || !newConfig.host || !newConfig.token) {
      pushMsg("请完整填写连接名称、地址和 Token。", "error");
      return;
    }

    setAddingConfig(true);
    setConfigMsg({ text: "", type: "" });

    try {
      const res = await fetchWithCsrf("/api/admin/configs", {
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();

      if (res.ok) {
        setConfigs((prev) => [...prev, data]);
        setNewConfig(EMPTY_FORM);
        pushMsg("连接已添加。", "success");
      } else {
        pushMsg(data.error || "添加连接失败。", "error");
      }
    } catch {
      pushMsg("网络请求失败。", "error");
    } finally {
      setAddingConfig(false);
    }
  }, [newConfig, pushMsg]);

  const handleDeleteConfig = useCallback(async (id: number) => {
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
        setConfigs((prev) => prev.filter((config) => config.id !== id));
        pushMsg("连接已移除。", "success");
      } else {
        pushMsg(data.error || "删除失败。", "error");
      }
    } catch {
      pushMsg("网络请求失败。", "error");
    }
  }, [confirmDeleteId, pushMsg]);

  const handleStartEdit = useCallback((config: Config) => {
    setEditingConfigId(config.id);
    setEditConfig({
      name: config.name,
      host: config.host,
      token: "",
    });
  }, []);

  const handleSaveEdit = useCallback(async (id: number) => {
    if (!editConfig.name || !editConfig.host || !editConfig.token) {
      pushMsg("编辑时需要重新填写名称、地址和新 Token。", "error");
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
        setConfigs((prev) =>
          prev.map((config) => (config.id === id ? data : config)),
        );
        setEditingConfigId(null);
        setEditConfig(EMPTY_FORM);
        pushMsg("连接已更新。", "success");
      } else {
        pushMsg(data.error || "更新失败。", "error");
      }
    } catch {
      pushMsg("网络请求失败。", "error");
    } finally {
      setSavingEdit(false);
    }
  }, [editConfig, pushMsg]);

  const renderField = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options?: {
      type?: string;
      placeholder?: string;
      hint?: string;
      required?: boolean;
    },
  ) => (
    <label className="space-y-2" htmlFor={id}>
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
        {options?.required ? " *" : ""}
      </span>
      <input
        id={id}
        type={options?.type || "text"}
        required={options?.required}
        placeholder={options?.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
      />
      {options?.hint && (
        <p className="text-xs text-slate-500">{options.hint}</p>
      )}
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-black tracking-tight text-white">
          连接配置
        </h2>
        <p className="text-sm text-slate-400">
          维护 OpenList 地址和 Token，保障导入任务可用。
        </p>
      </div>

      {configMsg.text && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm ${configMsg.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}
        >
          {configMsg.text}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-blue-400" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Loading Configs
          </p>
        </div>
      ) : (
        <>
          {configs.length > 0 ? (
            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-300">
                已配置连接
              </h3>
              <div className="space-y-4">
                {configs.map((config) => (
                  <article
                    key={config.id}
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md"
                  >
                    {editingConfigId === config.id ? (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 className="text-lg font-black tracking-tight text-white">
                              编辑连接
                            </h4>
                            <p className="text-sm text-slate-500">
                              当前地址：{activeEditHost}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          {renderField(
                            "edit-config-name",
                            "连接名称",
                            editConfig.name,
                            (value) =>
                              setEditConfig((prev) => ({
                                ...prev,
                                name: value,
                              })),
                            {
                              placeholder: "我的 OpenList",
                              required: true,
                            },
                          )}
                          {renderField(
                            "edit-config-host",
                            "OpenList 地址",
                            editConfig.host,
                            (value) =>
                              setEditConfig((prev) => ({
                                ...prev,
                                host: value,
                              })),
                            {
                              type: "url",
                              placeholder: "https://your-openlist.com",
                              required: true,
                            },
                          )}
                        </div>

                        {renderField(
                          "edit-config-token",
                          "新的访问 Token",
                          editConfig.token,
                          (value) =>
                            setEditConfig((prev) => ({
                              ...prev,
                              token: value,
                            })),
                          {
                            type: "password",
                            placeholder: "重新输入 Token",
                            hint: "出于安全原因，编辑连接时需要重新提供 Token。",
                            required: true,
                          },
                        )}

                        <div className="flex flex-wrap justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingConfigId(null);
                              setEditConfig(EMPTY_FORM);
                            }}
                            className="min-h-[40px] rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-white transition-all hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(config.id)}
                            disabled={savingEdit}
                            className="btn-primary min-h-[40px] justify-center px-4 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingEdit ? "保存中..." : "保存修改"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <h4 className="text-lg font-black tracking-tight text-white">
                              {config.name}
                            </h4>
                            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                              已连接
                            </span>
                          </div>
                          <p className="break-all text-sm text-slate-400">
                            {config.host}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(config)}
                            className="min-h-[40px] rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-white transition-all hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteConfig(config.id)}
                            className={`min-h-[40px] rounded-xl border px-4 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 ${confirmDeleteId === config.id ? "border-red-500 bg-red-500 text-white" : "border-red-500/30 bg-red-500/5 text-red-300 hover:border-red-500/40 hover:bg-red-500/10"}`}
                          >
                            {confirmDeleteId === config.id
                              ? "确认删除？"
                              : "删除"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <EmptyStatePanel
              title="还没有连接配置"
              description="暂无连接配置。"
            />
          )}

          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md sm:p-6">
            <div className="mb-5 space-y-2">
              <h3 className="text-lg font-black tracking-tight text-white">
                新增 OpenList 连接
              </h3>
              <p className="text-sm text-slate-400">填写名称、地址和 Token。</p>
            </div>

            <form onSubmit={handleAddConfig} noValidate className="space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {renderField(
                  "config-name",
                  "连接名称",
                  newConfig.name,
                  (value) => setNewConfig((prev) => ({ ...prev, name: value })),
                  {
                    placeholder: "我的 OpenList",
                    required: true,
                  },
                )}
                {renderField(
                  "config-host",
                  "OpenList 地址",
                  newConfig.host,
                  (value) => setNewConfig((prev) => ({ ...prev, host: value })),
                  {
                    type: "url",
                    placeholder: "https://your-openlist.com",
                    required: true,
                  },
                )}
              </div>

              {renderField(
                "config-token",
                "访问 Token",
                newConfig.token,
                (value) => setNewConfig((prev) => ({ ...prev, token: value })),
                {
                  type: "password",
                  placeholder: "OpenList 管理后台 -> 用户设置 -> Token",
                  hint: "粘贴 OpenList Token。",
                  required: true,
                },
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">建议使用专用 Token。</p>
                <button
                  type="submit"
                  disabled={addingConfig}
                  aria-busy={addingConfig}
                  className="btn-primary min-h-[44px] justify-center px-6 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addingConfig ? "验证连接中..." : "添加连接"}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
