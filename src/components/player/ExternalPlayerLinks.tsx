/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useMemo, useState, useRef, useEffect, memo } from "react";

interface PlayerOption {
  name: string;
  type: string;
  icon: string;
  color: string;
  desc: string;
}

const PLAYERS: PlayerOption[] = [
  {
    name: "IINA",
    type: "iina",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='%23000'/><polygon points='10 8 16 12 10 16 10 8' fill='%2300A0FF'/><path d='M8 8v8' stroke='%2300A0FF' stroke-width='2'/></svg>",
    color: "#000000",
    desc: "macOS",
  },
  {
    name: "PotPlayer",
    type: "potplayer",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='%23FFD600'/><polygon points='10 7 17 12 10 17 10 7' fill='%23FFF'/></svg>",
    color: "#FFD600",
    desc: "Windows",
  },
  {
    name: "VLC",
    type: "vlc",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2l-8 18h16L12 2z' fill='%23FF8A00'/><path d='M6 14h12l-1.5-3.5H7.5L6 14z' fill='%23FFF'/><path d='M4.5 17.5h15l-.5-1H5l-.5 1z' fill='%23FFF'/></svg>",
    color: "#FF8A00",
    desc: "跨平台",
  },
  {
    name: "nPlayer",
    type: "nplayer",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%231E90FF'/><polygon points='9 7 17 12 9 17 9 7' fill='%23FFF'/></svg>",
    color: "#1E90FF",
    desc: "移动端",
  },
  {
    name: "Infuse",
    type: "infuse",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%23FF4500'/><polygon points='9 7 17 12 9 17 9 7' fill='%23FFF'/></svg>",
    color: "#FF4500",
    desc: "Apple",
  },
  {
    name: "MX Player",
    type: "mxplayer",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%230084FF'/><polygon points='9 7 17 12 9 17 9 7' fill='%23FFF'/></svg>",
    color: "#0084FF",
    desc: "Android",
  },
  {
    name: "OPlayer",
    type: "oplayer",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='%230066FF'/><polygon points='10 8 16 12 10 16 10 8' fill='%23FFF'/></svg>",
    color: "#0066FF",
    desc: "通用",
  },
  {
    name: "iPlay",
    type: "iplay",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='%23FF1744'/><polygon points='10 8 16 12 10 16 10 8' fill='%23FFF'/></svg>",
    color: "#FF1744",
    desc: "iOS",
  },
  {
    name: "FileBall",
    type: "fileball",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%23448AFF'/><path d='M8 12h8m-4-4l4 4-4 4' stroke='%23FFF' stroke-width='2' fill='none'/></svg>",
    color: "#448AFF",
    desc: "文件管理",
  },
];

interface ExternalPlayerLinksProps {
  url: string;
  title: string;
}

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const toBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    const buffer = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);

    result += chars[(buffer >> 18) & 63];
    result += chars[(buffer >> 12) & 63];
    result += b === undefined ? "=" : chars[(buffer >> 6) & 63];
    result += c === undefined ? "=" : chars[buffer & 63];
  }

  return result;
};

/**
 * 外部播放器入口 — 紧凑下拉式设计
 * 默认只展示一个小按钮，点击展开播放器网格
 */
function ExternalPlayerLinks({
  url,
  title,
}: ExternalPlayerLinksProps) {
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sourceUrl = useMemo(() => safeDecode(url), [url]);

  const buildPlayerUrl = (type: string) => {
    const urlNoProtocol = sourceUrl.replace(/^https?:\/\//, "");
    const protocol = sourceUrl.startsWith("https") ? "https" : "http";

    switch (type) {
      case "potplayer":
        return `potplayer://${sourceUrl}`;
      case "vlc":
        return `vlc://${sourceUrl}`;
      case "iina":
        return `iina://weblink?url=${encodeURIComponent(sourceUrl)}`;
      case "nplayer":
        return `nplayer-${protocol}://${urlNoProtocol}`;
      case "infuse":
        return `infuse://x-callback-url/play?url=${encodeURIComponent(sourceUrl)}`;
      case "mxplayer":
        return `intent:${sourceUrl}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title)};end`;
      case "iplay":
        return `iplay://play/any?type=url&url=${toBase64(sourceUrl)}`;
      case "fileball":
        return `filebox://play?url=${encodeURIComponent(sourceUrl)}`;
      case "oplayer":
        return `oplayer://${sourceUrl}`;
      default:
        return sourceUrl;
    }
  };

  const handleIconError = (type: string) => {
    setFailedIcons((current) => ({ ...current, [type]: true }));
  };

  /** 点击外部区域自动关闭下拉面板 */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!url) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative inline-flex">
      {/* 触发按钮 — 紧凑胶囊样式 */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen((current) => !current)}
        className={`
                    inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 outline-none focus:outline-none
                    text-[11px] font-bold tracking-wide transition-all duration-200
                    ${
                      isOpen
                        ? "bg-white/15 text-white border border-white/20"
                        : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80"
                    }
                `}
      >
        {/* 外链图标 */}
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
          />
        </svg>
        外部播放
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-[320px] sm:w-[380px] rounded-lg border border-white/10 bg-[#0C0A09]/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-3 sm:p-4 transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
            选择外部播放器
          </p>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {PLAYERS.map((player) => (
              <a
                key={player.type}
                href={buildPlayerUrl(player.type)}
                target="_blank"
                rel="noreferrer"
                title={`${player.name} - ${player.desc}`}
                aria-label={`使用 ${player.name} 播放`}
                className="group flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1.5 transition-all duration-150 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
              >
                {!failedIcons[player.type] ? (
                  <img
                    alt={player.name}
                    src={player.icon}
                    className="h-8 w-8 shrink-0 rounded-lg object-contain opacity-80 transition-all duration-150 group-hover:opacity-100 group-hover:scale-110"
                    onError={() => handleIconError(player.type)}
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.name.slice(0, 1)}
                  </div>
                )}
                <span className="text-[10px] font-semibold text-white/70 group-hover:text-white truncate max-w-full">
                  {player.name}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ExternalPlayerLinks);
