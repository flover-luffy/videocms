"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithCsrf } from "@/lib/fetch-client";
import type { DanmakuSettings } from "./DanmakuLayer";

// ── 弹幕颜色预设 ──────────────────────────────────
const COLOR_PRESETS = [
  { label: "白", value: "#FFFFFF" },
  { label: "红", value: "#FE0302" },
  { label: "橙", value: "#FF7204" },
  { label: "黄", value: "#FFED02" },
  { label: "绿", value: "#00CD00" },
  { label: "蓝", value: "#00A1D6" },
  { label: "紫", value: "#CC00FF" },
] as const;

interface DanmakuInputProps {
  episodeId: string;
  currentTime: number;
  isFullscreen: boolean;
  settings: DanmakuSettings;
  onSettingsChange: (settings: Partial<DanmakuSettings>) => void;
  onDanmakuSent?: (danmaku: {
    id: number;
    text: string;
    time: number;
    color: string;
    type: number;
    fontSize: number;
  }) => void;
}

/**
 * 弹幕输入栏 — 集成在播放器底部
 *
 * 包含：
 * - 弹幕输入框 + 发送按钮
 * - 弹幕开/关切换
 * - 弹幕设置面板（颜色、透明度、速度、位置类型）
 */
const DanmakuInput: React.FC<DanmakuInputProps> = ({
  episodeId,
  currentTime,
  isFullscreen,
  settings,
  onSettingsChange,
  onDanmakuSent,
}) => {
  const [text, setText] = useState("");
  const [color, setColor] = useState("#FFFFFF");
  const [danmakuType, setDanmakuType] = useState(0); // 0=滚动 1=顶部 2=底部
  const [isSending, setIsSending] = useState(false);
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorPanelRef = useRef<HTMLDivElement>(null);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const res = await fetchWithCsrf("/api/danmaku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId: parseInt(episodeId, 10),
          text: trimmed,
          time: currentTime,
          color,
          type: danmakuType,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMessage = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "发送失败";
        throw new Error(errorMessage);
      }

      const result = await res.json();
      setText("");

      // 通知父组件实时显示刚发送的弹幕
      if (onDanmakuSent && result.data) {
        onDanmakuSent(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送弹幕失败");
      // 3 秒后自动清除错误
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSending(false);
    }
  }, [text, isSending, episodeId, currentTime, color, danmakuType, onDanmakuSent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void handleSend();
      }
      // 阻止播放器快捷键冲突
      e.stopPropagation();
    },
    [handleSend],
  );

  const toggleDanmaku = useCallback(() => {
    onSettingsChange({ enabled: !settings.enabled });
  }, [settings.enabled, onSettingsChange]);

  return (
    <div
      className={`flex items-center gap-1.5 sm:gap-2 ${isFullscreen ? "px-2" : ""}`}
    >
      {/* 弹幕开关 */}
      <button
        type="button"
        onClick={toggleDanmaku}
        title={settings.enabled ? "关闭弹幕" : "开启弹幕"}
        className={`shrink-0 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg border text-[10px] font-black transition-all ${
          settings.enabled
            ? "border-amber-400/30 bg-amber-500/20 text-amber-300"
            : "border-white/10 bg-white/5 text-white/40"
        }`}
      >
        弹
      </button>

      {/* 弹幕设置按钮 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowColorPanel(!showColorPanel)}
          title="弹幕设置"
          className="shrink-0 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white transition-all"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>

        {/* 弹幕设置面板 */}
        <AnimatePresence>
          {showColorPanel && (
            <motion.div
              ref={colorPanelRef}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="absolute bottom-full left-0 mb-2 w-56 sm:w-64 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl p-3 sm:p-4 shadow-2xl z-[200]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 颜色选择 */}
              <div className="mb-3">
                <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">
                  弹幕颜色
                </span>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      title={c.label}
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition-all ${
                        color === c.value
                          ? "border-amber-400 scale-110 shadow-lg"
                          : "border-white/20 hover:border-white/40"
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>

              {/* 弹幕类型 */}
              <div className="mb-3">
                <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">
                  弹幕位置
                </span>
                <div className="flex gap-2 mt-1.5">
                  {[
                    { v: 0, l: "滚动" },
                    { v: 1, l: "顶部" },
                    { v: 2, l: "底部" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setDanmakuType(opt.v)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        danmakuType === opt.v
                          ? "border-amber-400/30 bg-amber-500/20 text-amber-300"
                          : "border-white/10 bg-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 透明度 */}
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">
                    透明度
                  </span>
                  <span className="text-[10px] text-white/30">
                    {Math.round(settings.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={settings.opacity}
                  onChange={(e) =>
                    onSettingsChange({ opacity: parseFloat(e.target.value) })
                  }
                  className="w-full mt-1 accent-amber-500 h-1"
                />
              </div>

              {/* 速度 */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">
                    弹幕速度
                  </span>
                  <span className="text-[10px] text-white/30">
                    {settings.speed.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.speed}
                  onChange={(e) =>
                    onSettingsChange({ speed: parseFloat(e.target.value) })
                  }
                  className="w-full mt-1 accent-amber-500 h-1"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 弹幕输入框 */}
      <div className="relative flex-1 min-w-0 max-w-[280px] sm:max-w-[360px]">
        <input
          ref={inputRef}
          type="text"
          placeholder={settings.enabled ? "发一条弹幕..." : "弹幕已关闭"}
          disabled={!settings.enabled || isSending}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={200}
          className="w-full h-7 sm:h-8 px-3 rounded-lg border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/25 focus:border-amber-400/40 focus:bg-white/10 focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        />

        {/* 错误提示 */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-full left-0 mb-1 px-2 py-1 rounded-md bg-red-500/90 text-[10px] text-white whitespace-nowrap z-[200]"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 发送按钮 */}
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={!text.trim() || !settings.enabled || isSending}
        className="shrink-0 h-7 sm:h-8 px-3 sm:px-4 rounded-lg border border-amber-500/30 bg-amber-500/20 text-[10px] sm:text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {isSending ? "..." : "发送"}
      </button>
    </div>
  );
};

export default DanmakuInput;
