/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";

/**
 * 外部播放器配置
 * 移出组件防止重复创建
 */
const PLAYERS = [
    { name: "IINA", type: "iina", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='%23000'/><polygon points='10 8 16 12 10 16 10 8' fill='%2300A0FF'/><path d='M8 8v8' stroke='%2300A0FF' stroke-width='2'/></svg>", color: "#000000", desc: "macOS 播放器" },
    { name: "PotPlayer", type: "potplayer", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='%23FFD600'/><polygon points='10 7 17 12 10 17 10 7' fill='%23FFF'/></svg>", color: "#FFD600", desc: "Windows 首选" },
    { name: "VLC", type: "vlc", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2l-8 18h16L12 2z' fill='%23FF8A00'/><path d='M6 14h12l-1.5-3.5H7.5L6 14z' fill='%23FFF'/><path d='M4.5 17.5h15l-.5-1H5l-.5 1z' fill='%23FFF'/></svg>", color: "#FF8A00", desc: "全平台全能" },
    { name: "nPlayer", type: "nplayer", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%231E90FF'/><polygon points='9 7 17 12 9 17 9 7' fill='%23FFF'/></svg>", color: "#1E90FF", desc: "移动端神器" },
    { name: "Infuse", type: "infuse", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%23FF4500'/><polygon points='9 7 17 12 9 17 9 7' fill='%23FFF'/></svg>", color: "#FF4500", desc: "Apple 生态支持" },
    { name: "MX Player", type: "mxplayer", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%230084FF'/><polygon points='9 7 17 12 9 17 9 7' fill='%23FFF'/></svg>", color: "#0084FF", desc: "Android 备选" },
    { name: "OPlayer", type: "oplayer", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='%230066FF'/><polygon points='10 8 16 12 10 16 10 8' fill='%23FFF'/></svg>", color: "#0066FF", desc: "经典全能" },
    { name: "iPlay", type: "iplay", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='%23FF1744'/><polygon points='10 8 16 12 10 16 10 8' fill='%23FFF'/></svg>", color: "#FF1744", desc: "iOS 极速播放" },
    { name: "FileBall", type: "fileball", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%23448AFF'/><path d='M8 12h8m-4-4l4 4-4 4' stroke='%23FFF' stroke-width='2' fill='none'/></svg>", color: "#448AFF", desc: "文件管理级播放" },
];

interface ExternalPlayerLinksProps {
    url: string;
    title: string;
}

const ExternalPlayerLinks: React.FC<ExternalPlayerLinksProps> = ({ url, title }) => {
    // 管理图片加载失败状态，用于回退渲染
    const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});

    if (!url) return null;

    const generateUrl = (type: string) => {
        // API 已经返回了处理好编码的 URL，前端不再进行二次 encodeURI
        // 但是对于需要放入 query param 的场景，需要 encodeURIComponent。
        // 为了防止双重编码 (特别是 % 变成 %25)，我们先进行一次解码。
        const safeUrl = decodeURIComponent(url);
        const urlNoProto = url.replace(/^https?:\/\//, "");
        const protocol = url.startsWith("https") ? "https" : "http";

        switch (type) {
            case "potplayer": return `potplayer://${url}`;
            case "vlc": return `vlc://${url}`;
            case "iina": return `iina://weblink?url=${encodeURIComponent(safeUrl)}`;
            case "nplayer": return `nplayer-${protocol}://${urlNoProto}`;
            case "infuse": return `infuse://x-callback-url/play?url=${encodeURIComponent(safeUrl)}`;
            case "mxplayer": return `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title)};end`;
            case "iplay": return `iplay://play/any?type=url&url=${Buffer.from(url).toString("base64")}`;
            case "fileball": return `filebox://play?url=${encodeURIComponent(safeUrl)}`;
            case "oplayer": return `oplayer://${url}`;
            case "macast": return `macast://action=play&url=${encodeURIComponent(safeUrl)}`;
            default: return url;
        }
    };

    const handleIconError = (type: string) => {
        setFailedIcons(prev => ({ ...prev, [type]: true }));
    };

    return (
        <div className="flex items-center gap-4">
            <span className="text-[12px] font-black uppercase tracking-[0.25em] text-slate-200 mr-2 border-r border-white/20 pr-5 py-1.5 leading-none">第三方播放</span>
            <div className="flex items-center gap-6">
                {PLAYERS.map((p) => (
                    <a
                        key={p.type}
                        href={generateUrl(p.type)}
                        title={`${p.name} - ${p.desc}`}
                        target="_blank"
                        rel="noreferrer"
                        className="relative group/icon flex items-center justify-center w-9 h-9 transition-all duration-300 hover:scale-125 hover:-translate-y-1"
                    >
                        {!failedIcons[p.type] ? (
                            <img
                                alt={p.name}
                                className="w-full h-full object-contain filter grayscale opacity-50 contrast-125 brightness-75 transition-all duration-500 group-hover/icon:grayscale-0 group-hover/icon:opacity-100 group-hover/icon:brightness-100 group-hover/icon:drop-shadow-[0_0_12px_#3b82f699]"
                                src={p.icon}
                                onError={() => handleIconError(p.type)}
                            />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full rounded-full grayscale opacity-50 group-hover/icon:grayscale-0 group-hover/icon:opacity-100 transition-all shadow-sm" style={{ background: p.color, color: "#fff", fontWeight: "bold", fontSize: "12px" }}>
                                {p.name[0]}
                            </div>
                        )}
                        {/* 悬浮小光标 */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full opacity-0 scale-0 transition-all duration-300 group-hover/icon:opacity-100 group-hover/icon:scale-100 shadow-[0_0_8px_#3b82f6]" />
                    </a>
                ))}
            </div>
        </div>
    );
};

export default ExternalPlayerLinks;
