"use client";

import { useEffect, useState } from "react";
import EmptyStatePanel from "@/components/layout/EmptyStatePanel";
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

export default function ImportTab() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [importForm, setImportForm] = useState<ImportForm>({
    configId: "",
    path: "",
    title: "",
  });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    text: string;
    type: "success" | "error" | "";
  }>({ text: "", type: "" });

  useEffect(() => {
    const loadConfigs = async () => {
      const res = await fetch("/api/admin/configs");
      if (res.ok) {
        setConfigs(await res.json());
      }
    };

    loadConfigs().catch(console.error);
  }, []);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importForm.configId || !importForm.path) {
      return;
    }

    setImporting(true);
    setImportResult({ text: "", type: "" });

    try {
      const res = await fetchWithCsrf("/api/admin/import", {
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          configId: parseInt(importForm.configId, 10),
          path: importForm.path,
          title: importForm.title || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.newTracks !== undefined) {
          setImportResult({
            text: `导入完成，新增 ${data.newTracks} 条音频资源。`,
            type: "success",
          });
        } else {
          setImportResult({
            text: `导入完成，共写入 ${data.newEpisodes} 条记录，TMDB 元数据正在后台补全。`,
            type: "success",
          });
        }
      } else {
        setImportResult({
          text: `导入失败：${data.error}`,
          type: "error",
        });
      }
    } catch {
      setImportResult({
        text: "网络请求失败，请稍后重试。",
        type: "error",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-black tracking-tight text-white">
          导入 OpenList 目录
        </h2>
        <p className="text-sm text-slate-400">OpenList 目录导入。</p>
      </div>

      {configs.length === 0 ? (
        <EmptyStatePanel
          title="还没有可用连接"
          description="暂无 OpenList 连接。"
        />
      ) : (
        <form
          onSubmit={handleImport}
          noValidate
          className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md sm:p-6"
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                OpenList 连接
              </span>
              <select
                required
                value={importForm.configId}
                onChange={(e) =>
                  setImportForm((prev) => ({
                    ...prev,
                    configId: e.target.value,
                  }))
                }
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white transition-all focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              >
                <option value="">请选择连接</option>
                {configs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name} ({config.host})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                自定义标题
              </span>
              <input
                type="text"
                placeholder="留空则使用源目录名称"
                value={importForm.title}
                onChange={(e) =>
                  setImportForm((prev) => ({ ...prev, title: e.target.value }))
                }
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              OpenList 目录路径
            </span>
            <input
              type="text"
              required
              placeholder="/video/2024/ 或 /music/album-name"
              value={importForm.path}
              onChange={(e) =>
                setImportForm((prev) => ({ ...prev, path: e.target.value }))
              }
              aria-describedby="path-hint"
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            />
            <p id="path-hint" className="text-xs text-slate-500">
              目录示例：/video/2024/ 或 /music/album-name。
            </p>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">导入后可在媒体管理操作。</p>
            <button
              type="submit"
              disabled={importing}
              aria-busy={importing}
              className="btn-primary min-h-[44px] justify-center px-6 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing ? "导入中..." : "开始导入"}
            </button>
          </div>

          {importResult.text && (
            <div
              role="alert"
              className={`rounded-xl border px-4 py-3 text-sm ${importResult.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}
            >
              {importResult.text}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
