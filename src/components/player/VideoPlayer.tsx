"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Artplayer from "artplayer";
// @ts-ignore
import artplayerPluginJassub from "artplayer-plugin-jassub";
import Hls from "hls.js";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { fetchWithCsrf } from "@/lib/fetch-client";

interface Subtitle {
    url: string;
    name?: string;
    type?: string;
}

interface VideoInfo {
    id: string;
    title: string;
    url: string;
    subtitles?: Subtitle[];
    poster?: string;
}



import ExternalPlayerLinks from "./ExternalPlayerLinks";

const VideoPlayer = ({
    seriesId,
    episodeId,
    playlist,
}: {
    seriesId: string;
    episodeId: string;
    playlist: any[];
}) => {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const playerWrapperRef = useRef<HTMLDivElement>(null); // 新增：接管全屏显示的包装器
    const artRef = useRef<Artplayer | null>(null);
    const isSeekingRef = useRef(false); // 新增：锁定拖拽状态

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [autoNext, setAutoNext] = useState(true);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
    const [isPip, setIsPip] = useState(false);

    const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
    const screenshotTimerRef = useRef<NodeJS.Timeout | null>(null);

    const currentIndex = playlist.findIndex((ep) => ep.id === episodeId);
    const hasNext = currentIndex >= 0 && currentIndex < playlist.length - 1;
    const nextEpisodeId = hasNext ? playlist[currentIndex + 1].id : null;
    const prevEpisodeId = currentIndex > 0 ? playlist[currentIndex - 1].id : null;

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    const fetchPlayData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/play/episode/${episodeId}`);
            if (!res.ok) {
                if (res.status === 401) throw new Error("SESSION_EXPIRED");
                throw new Error("无法加载视频资源");
            }
            const data = await res.json();
            setVideoInfo(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [episodeId]);

    useEffect(() => {
        fetchPlayData();
    }, [fetchPlayData]);

    // 监听全屏变化
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (!videoInfo || !containerRef.current) return;

        const art = new Artplayer({
            container: containerRef.current,
            url: videoInfo.url,
            poster: videoInfo.poster || "",
            autoplay: true,
            muted: false,
            playbackRate: true,
            fullscreen: false, // 禁用原生全屏，由 React 接管
            pip: true,
            screenshot: true,
            setting: true,
            controls: [],
            customType: {
                m3u8: function (video: HTMLVideoElement, url: string) {
                    if (Hls.isSupported()) {
                        const hls = new Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                        video.src = url;
                    }
                },
            },
            plugins: [
                artplayerPluginJassub({
                    debug: false,
                    workerUrl: '/libs/jassub/worker/jassub-worker.js',
                    wasmUrl: '/libs/jassub/wasm/jassub-worker.wasm',
                    modernWasmUrl: '/libs/jassub/wasm/jassub-worker-modern.wasm',
                }),
            ],
        });

        artRef.current = art;

        art.on("ready", () => {
            const savedProgress = localStorage.getItem(`vcms-progress-${episodeId}`);
            if (savedProgress) art.currentTime = parseFloat(savedProgress);
            art.playbackRate = playbackSpeed;

            // 初始化高度变量
            if (containerRef.current) {
                const height = containerRef.current.clientHeight;
                containerRef.current.style.setProperty('--player-height', `${height}px`);
            }

            if (videoInfo.subtitles) {
                for (const sub of videoInfo.subtitles) {
                    if (sub.url) {
                        const isAss = sub.url.toLowerCase().endsWith('.ass') || sub.url.toLowerCase().endsWith('.ssa');
                        if (isAss) {
                            // 使用插件切换 ASS 字幕
                            (art.plugins as any).artplayerPluginJassub.switch(sub.url);
                        } else {
                            art.subtitle.url = sub.url;
                            art.subtitle.show = true;
                        }
                        break;
                    }
                }
            }
        });

        art.on("resize", () => {
            if (containerRef.current) {
                const height = containerRef.current.clientHeight;
                containerRef.current.style.setProperty('--player-height', `${height}px`);
            }
        });

        art.on("video:play", () => setIsPlaying(true));
        art.on("video:pause", () => setIsPlaying(false));
        art.on("video:timeupdate", () => {
            if (!isSeekingRef.current) {
                setCurrentTime(art.currentTime);
            }
        });
        art.on("video:loadedmetadata", () => setDuration(art.duration));
        art.on("video:volumechange", () => {
            setVolume(art.volume);
            setIsMuted(art.muted);
        });
        art.on("pip", (state: boolean) => setIsPip(state));
        art.on("video:ended", () => {
            if (autoNext && nextEpisodeId) {
                router.push(`/play/${seriesId}/${nextEpisodeId}`);
            }
        });

        const syncTimer = setInterval(() => {
            const ct = Math.floor(art.currentTime);
            if (ct <= 10) return;
            localStorage.setItem(`vcms-progress-${episodeId}`, String(ct));
            fetchWithCsrf("/api/play/progress", {
                method: "POST",
                body: JSON.stringify({ episodeId, position: ct, duration: art.duration || 0 }),
            }).catch(() => { });
        }, 10000);

        return () => {
            clearInterval(syncTimer);
            if (artRef.current) artRef.current.destroy();
        };
    }, [videoInfo, episodeId, nextEpisodeId, router, seriesId, autoNext, playbackSpeed]);

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = setTimeout(() => {
            if (isPlaying && !showSettings) setShowControls(false);
        }, 3500);
    };

    const handleScreenshot = async () => {
        if (!artRef.current) return;
        try {
            const base64 = await (artRef.current as any).screenshot();
            setScreenshotPreview(base64);
            if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
            screenshotTimerRef.current = setTimeout(() => setScreenshotPreview(null), 3000);

            const link = document.createElement("a");
            link.href = base64;
            link.download = `screenshot_${new Date().getTime()}.png`;
            link.click();
        } catch (err) {
            console.error("[Player] Screenshot Error:", err);
        }
    };

    const handlePip = () => {
        if (!artRef.current) return;
        artRef.current.pip = !artRef.current.pip;
    };

    const handleToggleFullscreen = () => {
        if (!playerWrapperRef.current) return;

        if (!document.fullscreenElement) {
            playerWrapperRef.current.requestFullscreen().catch(err => {
                console.error(`Fullscreen Error: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div className="w-full">
            <div
                ref={playerWrapperRef}
                className={`relative group overflow-hidden bg-black shadow-4xl mb-0 transition-all duration-500 ease-in-out ${isFullscreen ? "fixed inset-0 z-[9999] rounded-0" : "aspect-video rounded-[2.5rem]"}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => isPlaying && setShowControls(false)}
            >
                {/* 底层播放器渲染容器 */}
                <div ref={containerRef} className="w-full h-full z-0" />

                {/* 状态层：加载/错误/控制 */}
                <div className="absolute inset-0 z-[100] pointer-events-none">
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto"
                            >
                                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">Loading Source</span>
                            </motion.div>
                        )}

                        {error && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 pointer-events-auto"
                            >
                                <div className="p-8 aura-glass rounded-[2.5rem] text-center max-w-md">
                                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-6">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.876c1.27 0 2.06-1.383 1.428-2.503L13.428 6.91A1.5 1.5 0 0011.572 6.91L4.572 16.497c-.632 1.21.162 2.503 1.428 2.503z" /></svg>
                                    </div>
                                    <h3 className="text-xl font-black text-white italic mb-2">播放中断</h3>
                                    <p className="text-white/40 text-sm mb-6">{error}</p>
                                    <button
                                        onClick={() => router.back()}
                                        className="px-8 py-3 rounded-full bg-blue-500 text-white text-xs font-black uppercase tracking-widest hover:scale-105 transition-all"
                                    >
                                        返回列表
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!isLoading && !error && (
                        <motion.div
                            className="absolute inset-0 flex flex-col justify-end"
                            animate={{ opacity: showControls ? 1 : 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            {/* 截图预览 */}
                            <AnimatePresence>
                                {screenshotPreview && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="absolute right-8 bottom-32 p-2 aura-glass rounded-2xl pointer-events-auto"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={screenshotPreview} className="w-48 rounded-xl" alt="Screenshot" />
                                        <div className="absolute -top-2 -right-2 bg-blue-500 text-[8px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg">Saved</div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* 高级设置面板 */}
                            <AnimatePresence>
                                {showSettings && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-8 bottom-24 w-72 aura-glass rounded-[2rem] p-6 shadow-4xl pointer-events-auto"
                                    >
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Playback Hub</h4>
                                        <div className="flex flex-col gap-6">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white/60">播放倍速</span>
                                                <div className="flex gap-2">
                                                    {[1, 1.25, 1.5, 2].map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => {
                                                                setPlaybackSpeed(s);
                                                                if (artRef.current) artRef.current.playbackRate = s;
                                                            }}
                                                            className={`w-10 h-8 rounded-lg text-[10px] font-black transition-all ${playbackSpeed === s ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                                                        >
                                                            {s}x
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white/60">自动下一集</span>
                                                <button
                                                    onClick={() => setAutoNext(!autoNext)}
                                                    className={`w-10 h-5 rounded-full transition-all relative ${autoNext ? "bg-blue-600 shadow-lg shadow-blue-600/20" : "bg-white/10"}`}
                                                >
                                                    <motion.div
                                                        animate={{ x: autoNext ? 22 : 4 }}
                                                        className="absolute top-1 left-0 w-3 h-3 rounded-full bg-white shadow-md"
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* 控制面板主体 */}
                            <div className={`relative px-8 pb-4 flex flex-col pointer-events-auto bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 ${isFullscreen ? "pb-12" : "pb-2"}`}>
                                {/* 交互进度条 */}
                                <div className="relative group/progress h-1.5 w-full flex items-center cursor-pointer mb-4">
                                    <div className="absolute inset-x-0 h-1.5 bg-white/20 rounded-full" />
                                    <motion.div
                                        className="absolute inset-y-0 left-0 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,1)] z-10"
                                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                    />
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 100}
                                        value={currentTime}
                                        step="0.01"
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setCurrentTime(val);
                                            if (artRef.current) artRef.current.currentTime = val;
                                        }}
                                        onMouseDown={() => { isSeekingRef.current = true; }}
                                        onMouseUp={() => { isSeekingRef.current = false; }}
                                        onTouchStart={() => { isSeekingRef.current = true; }}
                                        onTouchEnd={() => { isSeekingRef.current = false; }}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                    />
                                    <motion.div
                                        className="absolute w-4 h-4 bg-white rounded-full border-2 border-blue-500 shadow-2xl z-20 pointer-events-none opacity-0 group-hover/progress:opacity-100 transition-opacity"
                                        style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, transform: "translateX(-50%)" }}
                                    />
                                </div>

                                <div className="flex items-center justify-between h-10">
                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={() => artRef.current && artRef.current.toggle()}
                                            className="text-white hover:text-blue-400 transition-all transform active:scale-90 filter drop-shadow-[0_0_10px_rgba(0,0,0,1)]"
                                        >
                                            {isPlaying ? (
                                                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                            ) : (
                                                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            )}
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={!prevEpisodeId}
                                                onClick={() => prevEpisodeId && router.push(`/play/${seriesId}/${prevEpisodeId}`)}
                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-5 active:scale-95 drop-shadow-[0_0_8px_rgba(0,0,0,1)]"
                                            >
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
                                            </button>
                                            <button
                                                disabled={!nextEpisodeId}
                                                onClick={() => nextEpisodeId && router.push(`/play/${seriesId}/${nextEpisodeId}`)}
                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-5 active:scale-95 drop-shadow-[0_0_8px_rgba(0,0,0,1)]"
                                            >
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="m6 18 8.5-6L6 6zm9-12v12h2V6z" /></svg>
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2 text-white font-mono drop-shadow-[0_0_10px_rgba(0,0,0,1)]">
                                            <span className="text-[14px] font-black tabular-nums">{formatTime(currentTime)}</span>
                                            <span className="text-[14px] font-black opacity-30">{"/"}</span>
                                            <span className="text-[14px] font-black opacity-60 tabular-nums">{formatTime(duration)}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={handleScreenshot}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-all drop-shadow-[0_0_8px_rgba(0,0,0,1)]"
                                            title="截图"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                                        </button>

                                        <div className="flex items-center gap-3 group/volume relative scale-100">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => artRef.current && (artRef.current.muted = !artRef.current.muted)}
                                                    className="text-white hover:text-blue-400 transition-colors drop-shadow-[0_0_8px_rgba(0,0,0,1)]"
                                                >
                                                    {(isMuted || volume === 0) ? (
                                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zM3 9v6h4l5 5V4L7 9H3z" /></svg>
                                                    ) : (
                                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>
                                                    )}
                                                </button>
                                                <div className="relative w-24 h-1 bg-white/30 rounded-full overflow-hidden">
                                                    <div className="absolute inset-y-0 left-0 bg-white shadow-[0_0_10px_white]" style={{ width: `${volume * 100}%` }} />
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.01"
                                                        value={volume}
                                                        onChange={(e) => artRef.current && (artRef.current.volume = parseFloat(e.target.value))}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            {/* 音量百分比数值 */}
                                            <span className="text-[10px] font-black text-white/40 tabular-nums w-8">
                                                {Math.round(volume * 100)}%
                                            </span>
                                        </div>

                                        <button
                                            onClick={handlePip}
                                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all drop-shadow-[0_0_8px_rgba(0,0,0,1)] ${isPip ? "text-blue-500 bg-blue-500/20 shadow-inner" : "text-white hover:bg-white/10"}`}
                                            title="画中画"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6.75V12m0 0H18m-4.5 0l4.5 4.5M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                                        </button>

                                        <button
                                            onClick={() => setShowSettings(!showSettings)}
                                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all drop-shadow-[0_0_8px_rgba(0,0,0,1)] ${showSettings ? "text-blue-500 bg-blue-500/20 shadow-inner" : "text-white hover:bg-white/10"}`}
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-9.75 0h9.75" /></svg>
                                        </button>

                                        <button
                                            onClick={handleToggleFullscreen}
                                            className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all drop-shadow-[0_0_15px_rgba(37,99,235,1)] ${isFullscreen ? "bg-blue-600 text-white" : "bg-blue-500/40 text-blue-400 hover:bg-blue-500 hover:text-white"}`}
                                        >
                                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* 底部信息与第三方链接 - 绝对贴边 */}
            {!isFullscreen && (
                <div className="relative flex flex-col items-center justify-center px-10 pt-1 pb-0 bg-transparent border-t-0 z-[110]">
                    <AnimatePresence>
                        {videoInfo && !error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-full flex justify-center pb-0"
                            >
                                <ExternalPlayerLinks url={videoInfo.url} title={videoInfo.title} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 自动连播 (物理最底边) */}
                    <div className="absolute right-6 bottom-0">
                        <div
                            onClick={() => setAutoNext(!autoNext)}
                            className="flex items-center gap-3 group bg-white/5 px-4 py-1.5 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-pointer hover:bg-white/10"
                        >
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-blue-400 transition-colors">自动连播</span>
                            <div className={`relative w-11 h-5.5 rounded-full transition-all duration-500 ${autoNext ? "bg-blue-600 shadow-[0_0_20px_#2563eb66]" : "bg-white/5 border border-white/10"}`}>
                                <motion.div
                                    layout
                                    animate={{ x: autoNext ? 24 : 4 }}
                                    className="absolute top-1 left-0 w-3.5 h-3.5 rounded-full bg-white shadow-lg"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .art-video-player .art-controls,
                .art-video-player .art-progress,
                .art-video-player .art-control-progress,
                .art-video-player .art-layer-gradient,
                .art-video-player .art-settings,
                .art-video-player .art-notice,
                .art-video-player .art-mask {
                    display: none !important;
                }
                .art-video-player {
                    background: black !important;
                }
                .art-subtitle {
                    bottom: 4.0% !important;
                    font-size: clamp(16px, calc(var(--player-height) * 0.045), 42px) !important;
                    font-weight: 900 !important;
                    text-shadow: 0 4px 12px rgba(0,0,0,0.95), 0 0 25px rgba(0,0,0,0.6) !important;
                    color: #fff !important;
                    padding: 0 40px !important;
                    pointer-events: none !important;
                    transition: bottom 0.3s ease, font-size 0.3s ease !important;
                }
                :fullscreen .art-subtitle,
                .art-video-player-fullscreen .art-subtitle {
                    bottom: 5.0% !important;
                    font-size: clamp(24px, calc(var(--player-height) * 0.08), 60px) !important;
                }
                :fullscreen {
                    background-color: black !important;
                }
            `}</style>
        </div>
    );
};

export default VideoPlayer;
