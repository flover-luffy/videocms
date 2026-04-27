"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { fetchWithCsrf } from "@/lib/fetch-client";
import ExternalPlayerLinks from "./ExternalPlayerLinks";
import DanmakuLayer, {
  type DanmakuData,
  type DanmakuSettings,
  DANMAKU_DEFAULT_SETTINGS,
} from "./DanmakuLayer";
import DanmakuInput from "./DanmakuInput";
import WatchTogether from "./WatchTogether";

interface Subtitle {
  url: string;
  name?: string;
  type?: string;
}

interface VideoInfo {
  id: string;
  title: string;
  url: string;
  rawUrl?: string;
  subtitles?: Subtitle[];
  poster?: string;
}

/** 播放列表条目（对应剧集单集简洁内容） */
interface PlaylistItem {
  id: string;
  title?: string;
  episodeNumber?: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeNonNegative = (value: unknown, fallback = 0) => {
  const normalized = isFiniteNumber(value) ? value : fallback;
  return Math.max(0, normalized);
};

const VideoPlayer = ({
  seriesId,
  episodeId,
  playlist,
}: {
  seriesId: string;
  episodeId: string;
  playlist: PlaylistItem[];
}) => {
  const router = useRouter();
  const reduceMotion = false;
  const containerRef = useRef<HTMLDivElement>(null);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<Artplayer | null>(null);
  const isSeekingRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const autoNext = true;
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null,
  );
  const [isPip, setIsPip] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // ── 弹幕状态 ──
  const [danmakuList, setDanmakuList] = useState<DanmakuData[]>([]);
  const [danmakuSettings, setDanmakuSettings] = useState<DanmakuSettings>(
    DANMAKU_DEFAULT_SETTINGS,
  );
  const [realtimeDanmaku, setRealtimeDanmaku] = useState<DanmakuData | null>(
    null,
  );
  const [playerDimensions, setPlayerDimensions] = useState({ w: 0, h: 0 });
  const [watchTogetherUserId, setWatchTogetherUserId] = useState<number | undefined>();
  const [watchTogetherEmail, setWatchTogetherEmail] = useState<string | undefined>();

  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const screenshotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seekReleaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);
  const showSettingsRef = useRef(false);
  const lastAudibleVolumeRef = useRef(0.8);

  const currentIndex = playlist.findIndex((ep) => ep.id === episodeId);
  const hasNext = currentIndex >= 0 && currentIndex < playlist.length - 1;
  const nextEpisodeId = hasNext ? playlist[currentIndex + 1].id : null;
  const prevEpisodeId = currentIndex > 0 ? playlist[currentIndex - 1].id : null;
  const currentEpisode = currentIndex >= 0 ? playlist[currentIndex] : null;

  const formatTime = (seconds: number) => {
    const safeSeconds = normalizeNonNegative(seconds, 0);
    const h = Math.floor(safeSeconds / 3600);
    const m = Math.floor((safeSeconds % 3600) / 60);
    const s = Math.floor(safeSeconds % 60);
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackMessage(null);
    }, 2200);
  }, []);

  const isFetchingRef = useRef(false);
  const fetchPlayData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "无法加载视频资源");
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [episodeId]);

  useEffect(() => {
    fetchPlayData();
  }, [fetchPlayData]);

  // ── 加载弹幕数据 ──
  useEffect(() => {
    const loadDanmakus = async () => {
      try {
        const res = await fetch(`/api/danmaku?episodeId=${episodeId}`);
        if (res.ok) {
          const result = await res.json();
          if (result.data && Array.isArray(result.data)) {
            setDanmakuList(result.data);
          }
        }
      } catch (err) {
        console.warn("[Player] 弹幕加载失败:", err);
      }
    };
    loadDanmakus();
  }, [episodeId]);

  // ── 获取用户信息（用于一起看 WebSocket 连接） ──
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user?.id && data.user?.email) {
            setWatchTogetherUserId(data.user.id);
            setWatchTogetherEmail(data.user.email);
          }
        }
      } catch {
        // 未登录用户静默忽略
      }
    };
    loadUserInfo();
  }, []);

  // ── 监控播放器容器尺寸 ──
  useEffect(() => {
    if (!playerWrapperRef.current) return;
    const updateDimensions = () => {
      if (playerWrapperRef.current) {
        setPlayerDimensions({
          w: playerWrapperRef.current.clientWidth,
          h: playerWrapperRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(playerWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  const handleDanmakuSettingsChange = useCallback(
    (patch: Partial<DanmakuSettings>) => {
      setDanmakuSettings((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const handleDanmakuSent = useCallback(
    (danmaku: DanmakuData) => {
      setDanmakuList((prev) => [...prev, danmaku]);
      setRealtimeDanmaku(danmaku);
      // 清空实时推入，避免重复
      setTimeout(() => setRealtimeDanmaku(null), 100);
    },
    [],
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      const nowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(nowFullscreen);
      if (!nowFullscreen && window.screen?.orientation?.unlock) {
        window.screen.orientation.unlock();
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);

  useEffect(() => {
    if (!videoInfo || !containerRef.current) return;

    // 使用第一个可用的字幕
    const subs = videoInfo.subtitles || [];
    const defaultSub = subs.find((s) => s.url);

    const isM3U8 = (videoInfo.url || "").toLowerCase().includes(".m3u8") || 
                   (videoInfo.rawUrl || "").toLowerCase().includes(".m3u8");

    const art = new Artplayer({
      container: containerRef.current,
      url: videoInfo.url,
      type: isM3U8 ? "m3u8" : "auto",
      poster: videoInfo.poster || "",
      autoplay: true,
      muted: false,
      playbackRate: true,
      aspectRatio: true,
      setting: true,
      hotkey: true,
      pip: true,
      screenshot: true,
      fullscreen: false,
      // 修复：在这里直接配置原生字幕引擎
      subtitle: defaultSub?.url
        ? {
            url: defaultSub.url,
            type: defaultSub.type || "vtt",
            encoding: "utf-8",
            style: {
              color: "#FFFFFF",
              textShadow: "0 2px 10px rgba(0,0,0,0.9)",
            },
          }
        : {},
      moreVideoAttr: {
        crossOrigin: "anonymous",
      },
      customType: {
        m3u8: function (video: HTMLVideoElement, url: string) {
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
          }
          video.crossOrigin = "anonymous";
        },
      },
    });

    // ── HLS.js textTrack 索引偏移修复 ──
    // 当 HLS.js 挂载后，会向 video 注入额外的隐藏 textTrack（例如 CEA-608），
    // 导致原本索引为 0 的字幕轨道被向后挤压。Artplayer 内部硬编码了 `textTracks[0]`，
    // 从而导致字幕监听和获取全部失效。
    // 解决方案：重写 art.subtitle.textTrack 的 getter，动态寻找我们注入的正确轨道。
    const INJECTED_TRACK_LABEL = "vcms-subtitle";
    if (art.subtitle) {
      Object.defineProperty(art.subtitle, "textTrack", {
        get: () => {
          const tracks = art.video.textTracks;
          if (!tracks || tracks.length === 0) return undefined;
          // 优先查找我们手动注入的轨道，再查找 Artplayer 自身创建的轨道
          return (
            Array.from(tracks).find(
              (t) =>
                t.label === INJECTED_TRACK_LABEL ||
                t.label === "Artplayer"
            ) || tracks[0]
          );
        },
      });
    }

    artRef.current = art;

    // 移动端全屏状态同步与原生字幕注入修复
    const videoElement = art.video;

    const onWebkitBeginFullscreen = () => {
      setIsFullscreen(true);
    };
    const onWebkitEndFullscreen = () => {
      setIsFullscreen(false);
      // 延迟触发 layout 更新确保布局已回正，并清理可能残留的状态
      setTimeout(() => {
        if (artRef.current) {
          if (
            typeof (artRef.current as unknown as { autoSize: () => void })
              .autoSize === "function"
          ) {
            (artRef.current as unknown as { autoSize: () => void }).autoSize();
          }
          artRef.current.emit("resize");
        }
      }, 150);
    };

    if (videoElement) {
      videoElement.addEventListener(
        "webkitbeginfullscreen",
        onWebkitBeginFullscreen,
      );
      videoElement.addEventListener(
        "webkitendfullscreen",
        onWebkitEndFullscreen,
      );
      videoElement.addEventListener(
        "webkitfullscreenchange",
        onWebkitEndFullscreen,
      );
    }

    art.on("ready", () => {
      const savedProgress = localStorage.getItem(`vcms-progress-${episodeId}`);
      if (savedProgress) {
        const parsedSavedProgress = Number.parseFloat(savedProgress);
        if (isFiniteNumber(parsedSavedProgress) && parsedSavedProgress >= 0) {
          art.currentTime = parsedSavedProgress;
        } else {
          localStorage.removeItem(`vcms-progress-${episodeId}`);
        }
      }
      art.playbackRate = playbackSpeed;
      setVolume(art.volume);
      setIsMuted(art.muted);
      if (art.volume > 0.001) {
        lastAudibleVolumeRef.current = art.volume;
      }

      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        containerRef.current.style.setProperty(
          "--player-height",
          `${height}px`,
        );
      }

      // 确保字幕可见（Artplayer 内置字幕渲染 + 原生 track 保底）
      if (defaultSub?.url) {
        if (art.subtitle) {
          art.subtitle.show = true;
          // 强制添加 CSS class，防止插件延迟或被抑制
          if (art.template && art.template.$player) {
            art.template.$player.classList.add("art-subtitle-show");
          }
        }
        // 保底机制：注入原生 <track> 元素，利用浏览器的原生字幕渲染器。
        // 这确保即使 Artplayer 的字幕引擎因 CORS 或移动端兼容性问题失效，
        // 浏览器仍能通过原生 track 显示字幕。
        const existingTrack = art.video.querySelector("track");
        if (!existingTrack) {
          const track = document.createElement("track");
          track.kind = "captions";
          track.label = INJECTED_TRACK_LABEL;
          track.srclang = "zh";
          track.default = true;
          track.src = defaultSub.url;
          art.video.appendChild(track);
        }
      }
    });

    const syncBufferedProgress = () => {
      const videoEl = (art as unknown as { video?: HTMLVideoElement }).video as
        | HTMLVideoElement
        | undefined;
      if (
        !videoEl ||
        !Number.isFinite(videoEl.duration) ||
        videoEl.duration <= 0 ||
        videoEl.buffered.length === 0
      ) {
        setBufferedPercent(0);
        return;
      }
      const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
      setBufferedPercent((bufferedEnd / videoEl.duration) * 100);
    };

    art.on("resize", () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        containerRef.current.style.setProperty(
          "--player-height",
          `${height}px`,
        );
      }
    });

    art.on("video:play", () => setIsPlaying(true));
    art.on("video:pause", () => setIsPlaying(false));
    art.on("video:timeupdate", () => {
      const nextTime = art.currentTime;
      if (
        !isSeekingRef.current &&
        isFiniteNumber(nextTime) &&
        nextTime >= 0
      ) {
        setCurrentTime(nextTime);
      }
    });
    art.on("video:loadedmetadata", () => {
      const nextDuration = art.duration;
      setDuration(
        isFiniteNumber(nextDuration) && nextDuration > 0 ? nextDuration : 0,
      );
      syncBufferedProgress();
    });
    art.on("video:progress", syncBufferedProgress);
    art.on("video:volumechange", () => {
      setVolume(art.volume);
      setIsMuted(art.muted);
      if (!art.muted && art.volume > 0.001) {
        lastAudibleVolumeRef.current = art.volume;
      }
    });
    art.on("pip", (state: boolean) => setIsPip(state));
    art.on("video:ended", () => {
      if (autoNext && nextEpisodeId) {
        router.push(`/play/${seriesId}/${nextEpisodeId}`);
      }
    });

    // 每 10 秒同步一次播放进度到后端（localStorage 始终保存，API 调用静默失败）
    const syncTimer = setInterval(() => {
      const rawCurrentTime = art.currentTime;
      if (!isFiniteNumber(rawCurrentTime)) return;

      const ct = Math.floor(rawCurrentTime);
      if (ct <= 10) return;

      localStorage.setItem(`vcms-progress-${episodeId}`, String(ct));

      const rawDuration = art.duration;
      const safeDuration =
        isFiniteNumber(rawDuration) && rawDuration > 0
          ? Math.floor(rawDuration)
          : 0;

      fetchWithCsrf("/api/play/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId: parseInt(episodeId, 10),
          position: ct,
          duration: safeDuration,
        }),
      }).catch(() => {
        /* Ignore API failures for anonymous/offline playback. */
      });
    }, 10000);

    return () => {
      clearInterval(syncTimer);
      if (videoElement) {
        videoElement.removeEventListener(
          "webkitbeginfullscreen",
          onWebkitBeginFullscreen,
        );
        videoElement.removeEventListener(
          "webkitendfullscreen",
          onWebkitEndFullscreen,
        );
        videoElement.removeEventListener(
          "webkitfullscreenchange",
          onWebkitEndFullscreen,
        );
      }
      if (artRef.current) artRef.current.destroy();
    };
  }, [
    videoInfo,
    episodeId,
    nextEpisodeId,
    router,
    seriesId,
    autoNext,
    playbackSpeed,
  ]);

  // 全屏状态自愈检查：处理某些浏览器不触发退出全屏事件的情况
  useEffect(() => {
    const recoverState = () => {
      const isNativeFullscreen = !!(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element })
          .webkitFullscreenElement ||
        (document as unknown as { mozFullScreenElement?: Element })
          .mozFullScreenElement ||
        (document as unknown as { msFullscreenElement?: Element })
          .msFullscreenElement
      );

      if (!isNativeFullscreen && isFullscreen) {
        console.info(
          "[Player] Fullscreen state mismatch detected, recovering...",
        );
        setIsFullscreen(false);
        if (artRef.current)
          (artRef.current as unknown as { resize: () => void }).resize();
      }
    };

    const timer = setInterval(recoverState, 2000);
    window.addEventListener("focus", recoverState);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", recoverState);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!artRef.current) return;
    artRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  const scheduleHideControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (
        isPlayingRef.current &&
        !showSettingsRef.current &&
        !isSeekingRef.current
      ) {
        setShowControls(false);
      }
    }, 2600);
  }, []);

  const clearSeekReleaseTimer = useCallback(() => {
    if (seekReleaseTimerRef.current) {
      clearTimeout(seekReleaseTimerRef.current);
      seekReleaseTimerRef.current = null;
    }
  }, []);

  const startSeeking = useCallback(() => {
    isSeekingRef.current = true;
    clearSeekReleaseTimer();
    // Fallback to avoid a stuck seeking state when pointerup/pointercancel is missed.
    seekReleaseTimerRef.current = setTimeout(() => {
      isSeekingRef.current = false;
      seekReleaseTimerRef.current = null;
    }, 5000);
  }, [clearSeekReleaseTimer]);

  const stopSeeking = useCallback(
    (hideControlsAfter = true) => {
      isSeekingRef.current = false;
      clearSeekReleaseTimer();
      if (hideControlsAfter) {
        scheduleHideControls();
      }
    },
    [clearSeekReleaseTimer, scheduleHideControls],
  );

  const handleUserActivity = () => {
    scheduleHideControls();
  };

  useEffect(() => {
    const releaseSeeking = () => {
      if (isSeekingRef.current) {
        stopSeeking(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        releaseSeeking();
      }
    };

    window.addEventListener("pointerup", releaseSeeking, true);
    window.addEventListener("pointercancel", releaseSeeking, true);
    window.addEventListener("blur", releaseSeeking);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pointerup", releaseSeeking, true);
      window.removeEventListener("pointercancel", releaseSeeking, true);
      window.removeEventListener("blur", releaseSeeking);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [stopSeeking]);

  useEffect(() => {
    if (isPlaying) {
      scheduleHideControls();
    } else {
      setShowControls(true);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isPlaying, scheduleHideControls]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
      clearSeekReleaseTimer();
    };
  }, [clearSeekReleaseTimer]);

  const handleTogglePlay = useCallback(() => {
    if (!artRef.current) return;
    artRef.current.toggle();
  }, []);

  const seekTo = useCallback(
    (nextTime: number) => {
      if (!artRef.current) return;
      const playerDuration = artRef.current.duration;
      const safeDuration =
        isFiniteNumber(playerDuration) && playerDuration > 0
          ? playerDuration
          : normalizeNonNegative(duration, 0);
      if (safeDuration <= 0) return;
      const normalizedNextTime = isFiniteNumber(nextTime)
        ? nextTime
        : normalizeNonNegative(currentTime, 0);
      const clampedTime = clamp(normalizedNextTime, 0, safeDuration);
      if (isSeekingRef.current) {
        stopSeeking(false);
      }
      artRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    },
    [currentTime, duration, stopSeeking],
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      if (!artRef.current) return;
      const baseTime = isFiniteNumber(artRef.current.currentTime)
        ? artRef.current.currentTime
        : normalizeNonNegative(currentTime, 0);
      seekTo(baseTime + deltaSeconds);
      showFeedback(
        deltaSeconds > 0
          ? `+${Math.abs(deltaSeconds)}s`
          : `-${Math.abs(deltaSeconds)}s`,
      );
    },
    [currentTime, seekTo, showFeedback],
  );

  const handleScreenshot = async () => {
    if (!artRef.current) return;
    try {
      const base64 = await (
        artRef.current as unknown as { screenshot: () => Promise<string> }
      ).screenshot();
      setScreenshotPreview(base64);
      showFeedback("截图已保存");
      if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
      screenshotTimerRef.current = setTimeout(
        () => setScreenshotPreview(null),
        3000,
      );
    } catch (err) {
      console.error("[Player] Screenshot Error:", err);
    }
  };

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!artRef.current) return;
    const safeVolume = clamp(newVolume, 0, 1);
    artRef.current.volume = safeVolume;
    artRef.current.muted = safeVolume <= 0.001;
    if (safeVolume > 0.001) {
      lastAudibleVolumeRef.current = safeVolume;
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!artRef.current) return;
    const player = artRef.current;
    const currentlySilent = player.muted || player.volume <= 0.001;

    if (currentlySilent) {
      const restoredVolume = clamp(
        lastAudibleVolumeRef.current || 0.6,
        0.05,
        1,
      );
      player.volume = restoredVolume;
      player.muted = false;
      showFeedback("已开启声音");
      return;
    }

    if (player.volume > 0.001) {
      lastAudibleVolumeRef.current = player.volume;
    }
    player.muted = true;
    showFeedback("已静音");
  }, [showFeedback]);

  const handlePip = useCallback(() => {
    if (!artRef.current) return;
    const nextPip = !artRef.current.pip;
    artRef.current.pip = nextPip;
    showFeedback(nextPip ? "已打开画中画" : "已退出画中画");
  }, [showFeedback]);

  const handleToggleFullscreen = useCallback(async () => {
    if (!playerWrapperRef.current) return;

    if (!document.fullscreenElement) {
      try {
        const videoEl = (
          artRef.current as unknown as { video?: HTMLVideoElement }
        )?.video as HTMLVideoElement | undefined;
        const webkitEnter = (
          videoEl as unknown as { webkitEnterFullscreen?: () => void }
        )?.webkitEnterFullscreen;
        if (videoEl && typeof webkitEnter === "function") {
          webkitEnter.call(videoEl);
          setIsFullscreen(true);
          return;
        }

        await playerWrapperRef.current.requestFullscreen();
        const orientation = window.screen?.orientation as unknown as {
          lock?: (o: string) => Promise<void>;
          unlock?: () => void;
        };
        if (orientation?.lock) {
          try {
            await orientation.lock("landscape");
          } catch {
            // 忽略某些平台（如部分桌面浏览器）不支持方向锁定的报错
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Fullscreen API Notice: ${msg}`);
      }
    } else {
      try {
        if (window.screen?.orientation?.unlock) {
          try {
            window.screen.orientation.unlock();
          } catch {
            // 忽略解锁异常
          }
        }
        await document.exitFullscreen();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Exit Fullscreen Notice: ${msg}`);
      }
    }
  }, []);

  useEffect(() => {
    if (!showSettings) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!settingsPanelRef.current) return;
      if (settingsPanelRef.current.contains(event.target as Node)) return;
      setShowSettings(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [showSettings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const wrapper = playerWrapperRef.current;
      if (!wrapper) return;

      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;

      const activeElement = document.activeElement as HTMLElement | null;
      const hasPlayerFocus = activeElement
        ? wrapper.contains(activeElement)
        : false;
      const hasPageFocus = !activeElement || activeElement === document.body;
      if (!hasPlayerFocus && !hasPageFocus) return;

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          handleTogglePlay();
          break;
        case "arrowleft":
        case "j":
          event.preventDefault();
          seekBy(-10);
          break;
        case "arrowright":
        case "l":
          event.preventDefault();
          seekBy(10);
          break;
        case "m":
          event.preventDefault();
          handleToggleMute();
          break;
        case "f":
          event.preventDefault();
          void handleToggleFullscreen();
          break;
        case "escape":
          if (showSettings) {
            event.preventDefault();
            setShowSettings(false);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handleToggleFullscreen,
    handleToggleMute,
    handleTogglePlay,
    seekBy,
    showSettings,
  ]);

  const isVolumeSilent = isMuted || volume <= 0.001;
  const isVolumeLow = !isVolumeSilent && volume < 0.5;
  const renderVolumeIcon = (className: string) => {
    if (isVolumeSilent) {
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.92 8.92 0 003.69-1.81L19.73 21 21 19.73 12 10.73 4.27 3zm7.73 1v5.73l-2-2V6.83L12 4zm2 3.23v2.06A4.99 4.99 0 0116.5 12c0 .22-.02.43-.05.64l1.57 1.57A6.94 6.94 0 0019 12c0-3.18-2.11-5.86-5-6.77z" />
        </svg>
      );
    }

    if (isVolumeLow) {
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
      );
    }

    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zM3 9v6h4l5 5V4L7 9H3z" />
      </svg>
    );
  };

  return (
    <div className="w-full">
      <div
        ref={playerWrapperRef}
        tabIndex={0}
        aria-label="视频播放器，可使用键盘快捷键控制播放"
        className={`relative group overflow-hidden bg-black shadow-4xl mb-0 transition-all duration-500 ease-in-out focus:outline-none focus-visible:outline-none ${isFullscreen ? "fixed inset-0 z-[9999] rounded-none" : "aspect-video rounded-none"}`}
        onMouseMoveCapture={handleUserActivity}
        onPointerMoveCapture={handleUserActivity}
        onPointerDownCapture={handleUserActivity}
        onTouchStartCapture={handleUserActivity}
        onTouchMoveCapture={handleUserActivity}
        onClickCapture={handleUserActivity}
        onMouseLeave={() =>
          isPlaying && !showSettings && setShowControls(false)
        }
      >
        <div ref={containerRef} className="w-full h-full z-0" />
        {/* 弹幕渲染层 */}
        {playerDimensions.w > 0 && playerDimensions.h > 0 && (
          <DanmakuLayer
            danmakus={danmakuList}
            currentTime={currentTime}
            isPlaying={isPlaying}
            containerWidth={playerDimensions.w}
            containerHeight={playerDimensions.h}
            settings={danmakuSettings}
            realtimeDanmaku={realtimeDanmaku}
          />
        )}
        <div aria-live="polite" className="sr-only">
          {feedbackMessage || ""}
        </div>

        <div className="absolute inset-0 z-[100] pointer-events-none">
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto"
              >
                <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] animate-pulse">
                  加载资源中
                </span>
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
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.876c1.27 0 2.06-1.383 1.428-2.503L13.428 6.91A1.5 1.5 0 0011.572 6.91L4.572 16.497c-.632 1.21.162 2.503 1.428 2.503z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white italic mb-2">
                    播放中断
                  </h3>
                  <p role="alert" className="text-white/40 text-sm mb-6">
                    {error}
                  </p>
                  <button
                    onClick={() => router.back()}
                    className="px-8 py-3 rounded-full bg-amber-500 text-white text-xs font-black uppercase tracking-widest hover:scale-105 transition-all"
                  >
                    返回列表
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isLoading && !error && (
            <motion.div
              className={`absolute inset-x-0 bottom-0 flex flex-col justify-end z-[110] ${showControls ? "pointer-events-auto" : "pointer-events-none"}`}
              animate={
                reduceMotion
                  ? { opacity: showControls ? 1 : 0 }
                  : { opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.4, ease: "easeOut" }
              }
            >
              <AnimatePresence>
                {feedbackMessage && (
                  <motion.div
                    initial={
                      reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-[11px] font-bold tracking-[0.16em] text-white shadow-xl backdrop-blur-md"
                  >
                    {feedbackMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {screenshotPreview && (
                  <motion.div
                    initial={
                      reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }
                    }
                    animate={{ opacity: 1, x: 0 }}
                    exit={
                      reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }
                    }
                    className="absolute right-4 sm:right-8 bottom-24 sm:bottom-28 p-2 aura-glass rounded-2xl pointer-events-auto"
                  >
                    <Image
                      src={screenshotPreview}
                      alt="截图预览"
                      width={192}
                      height={108}
                      unoptimized
                      className="w-32 sm:w-48 h-auto rounded-xl"
                    />
                    <div className="absolute -top-2 -right-2 bg-amber-500 text-[8px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg">
                      已保存
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    ref={settingsPanelRef}
                    initial={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 10, scale: 0.95 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 10, scale: 0.95 }
                    }
                    role="dialog"
                    aria-label="播放设置"
                    className="absolute right-3 sm:right-8 bottom-16 sm:bottom-24 w-[calc(100%-1.5rem)] sm:w-72 aura-glass rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-5 shadow-4xl pointer-events-auto z-[150]"
                  >
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">
                      播放设置
                    </h4>
                    <div className="flex flex-col gap-4 sm:gap-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span className="text-xs font-bold text-white/60">
                          播放倍速
                        </span>
                        <div className="grid grid-cols-4 gap-2">
                          {[1, 1.25, 1.5, 2].map((s) => (
                            <button
                              key={s}
                              type="button"
                              aria-pressed={playbackSpeed === s}
                              onClick={() => {
                                setPlaybackSpeed(s);
                                showFeedback(`倍速 ${s}x`);
                              }}
                              className={`min-h-[40px] rounded-xl border text-[10px] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${playbackSpeed === s ? "border-amber-400/40 bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10"}`}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={handleToggleMute}
                            className="inline-flex items-center gap-2 text-xs font-bold text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                            aria-label={isVolumeSilent ? "开启声音" : "静音"}
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5">
                              {renderVolumeIcon("h-4 w-4")}
                            </span>
                            音量
                          </button>
                          <span className="text-[11px] font-black text-white/35">
                            {Math.round(volume * 100)}%
                          </span>
                        </div>
                        <div className="relative h-10 rounded-full border border-white/10 bg-white/5 px-4">
                          <div
                            className="absolute inset-y-1.5 left-1.5 rounded-full bg-white/80"
                            style={{
                              width: `calc(${Math.max(volume * 100, 6)}% - 0.75rem)`,
                            }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) =>
                              handleVolumeChange(parseFloat(e.target.value))
                            }
                            className="player-range-hitbox absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                            aria-label="音量调节"
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[10px] font-semibold tracking-wide text-white/60">
                        <span className="block text-white/80">快捷键</span>
                        <span className="mt-1 block">
                          Space/K 播放暂停 · J/L 快退快进 10 秒 · M 静音 · F
                          全屏
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleScreenshot}
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white/75 transition-all hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                            />
                          </svg>
                          截图
                        </button>
                        <button
                          type="button"
                          onClick={handlePip}
                          className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${isPip ? "border-amber-400/30 bg-amber-500/15 text-amber-200" : "border-white/10 bg-white/5 text-white/75 hover:border-white/20 hover:bg-white/10"}`}
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.5 6.75V12m0 0H18m-4.5 0l4.5 4.5M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                            />
                          </svg>
                          画中画
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowSettings(false)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-black uppercase tracking-[0.22em] text-white/75 transition-all hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                      >
                        完成
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div
                className={`relative pl-[calc(0.75rem+env(safe-area-inset-left))] pr-[calc(0.75rem+env(safe-area-inset-right))] sm:pl-[calc(1.25rem+env(safe-area-inset-left))] sm:pr-[calc(1.25rem+env(safe-area-inset-right))] md:pl-[calc(1.5rem+env(safe-area-inset-left))] md:pr-[calc(1.5rem+env(safe-area-inset-right))] flex flex-col pointer-events-auto bg-gradient-to-t from-black via-black/40 to-transparent pt-5 sm:pt-8 md:pt-10 ${isFullscreen ? "pb-[calc(2.25rem+env(safe-area-inset-bottom))]" : "pb-[calc(0.35rem+env(safe-area-inset-bottom))] sm:pb-2"}`}
              >
                {/* 进度条：增强触控 */}
                <div className="relative group/progress h-7 sm:h-6 md:h-6 w-full flex items-center cursor-pointer mb-1 sm:mb-2">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 sm:h-[8px] md:h-[7px] bg-white/10 rounded-full" />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 left-0 h-3 sm:h-[8px] md:h-[7px] bg-white/25 rounded-full z-[5]"
                    style={{ width: `${clamp(bufferedPercent, 0, 100)}%` }}
                  />
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 left-0 h-3 sm:h-[8px] md:h-[7px] bg-amber-500 rounded-full shadow-[0_0_8px_rgba(217,119,6,0.5)] z-10"
                    style={{
                      width: `${duration > 0 && isFiniteNumber(currentTime) ? clamp((currentTime / duration) * 100, 0, 100) : 0}%`,
                    }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={duration > 0 && isFiniteNumber(duration) ? duration : 100}
                    value={isFiniteNumber(currentTime) ? currentTime : 0}
                    step="0.01"
                    aria-label="播放进度"
                    onChange={(e) => {
                      const val = Number.parseFloat(e.target.value);
                      if (!isFiniteNumber(val)) return;

                      const seekLimit =
                        duration > 0 && isFiniteNumber(duration) ? duration : 0;
                      const safeValue =
                        seekLimit > 0 ? clamp(val, 0, seekLimit) : Math.max(0, val);

                      setCurrentTime(safeValue);
                      if (artRef.current) artRef.current.currentTime = safeValue;
                    }}
                    onPointerDown={(event) => {
                      startSeeking();
                      if (event.currentTarget.setPointerCapture) {
                        try {
                          event.currentTarget.setPointerCapture(event.pointerId);
                        } catch {
                          // Ignore pointer-capture support quirks on some browsers.
                        }
                      }
                    }}
                    onPointerUp={(event) => {
                      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                        try {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        } catch {
                          // Ignore pointer-capture support quirks on some browsers.
                        }
                      }
                      stopSeeking(true);
                    }}
                    onPointerCancel={(event) => {
                      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                        try {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        } catch {
                          // Ignore pointer-capture support quirks on some browsers.
                        }
                      }
                      stopSeeking(false);
                    }}
                    onPointerLeave={() => {
                      if (isSeekingRef.current) {
                        stopSeeking(false);
                      }
                    }}
                    className="player-range-hitbox absolute inset-0 opacity-0 cursor-pointer z-20 h-full w-full touch-manipulation"
                  />
                </div>

                <div className="flex flex-col lg:flex-row items-center justify-between gap-1.5 sm:gap-2">
                  <div className="flex items-center justify-between lg:justify-start w-full lg:w-auto gap-1.5 sm:gap-2 md:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        aria-label={isPlaying ? "暂停播放" : "开始播放"}
                        className="w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full text-white hover:text-amber-400 transition-all transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                      >
                        {isPlaying ? (
                          <svg
                            className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>

                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <button
                          type="button"
                          disabled={!prevEpisodeId}
                          aria-label="播放上一集"
                          onClick={() =>
                            prevEpisodeId &&
                            router.push(`/play/${seriesId}/${prevEpisodeId}`)
                          }
                          className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-white/5 sm:bg-white/10 text-white active:scale-95 disabled:opacity-20 transition-all border border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                        >
                          <svg
                            className="w-4 h-4 md:w-[18px] md:h-[18px]"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          disabled={!nextEpisodeId}
                          aria-label="播放下一集"
                          onClick={() =>
                            nextEpisodeId &&
                            router.push(`/play/${seriesId}/${nextEpisodeId}`)
                          }
                          className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-white/5 sm:bg-white/10 text-white active:scale-95 disabled:opacity-20 transition-all border border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                        >
                          <svg
                            className="w-4 h-4 md:w-[18px] md:h-[18px]"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="m6 18 8.5-6L6 6zm9-12v12h2V6z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => seekBy(-10)}
                          aria-label="后退 10 秒"
                          className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-white/5 sm:bg-white/10 text-white active:scale-95 transition-all border border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                        >
                          <span className="text-[9px] font-black tracking-tight sm:text-[10px]">
                            -10
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => seekBy(10)}
                          aria-label="快进 10 秒"
                          className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-white/5 sm:bg-white/10 text-white active:scale-95 transition-all border border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                        >
                          <span className="text-[9px] font-black tracking-tight sm:text-[10px]">
                            +10
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-white font-mono shrink-0">
                      {currentEpisode?.episodeNumber ? (
                        <span className="hidden sm:inline-flex rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/70">
                          E{currentEpisode.episodeNumber}
                        </span>
                      ) : null}
                      <span className="text-[8px] sm:text-[10px] md:text-[11px] font-black tabular-nums">
                        {formatTime(currentTime)}
                      </span>
                      <span className="text-[8px] sm:text-[10px] md:text-[11px] font-black opacity-30">
                        /
                      </span>
                      <span className="text-[8px] sm:text-[10px] md:text-[11px] font-black opacity-60 tabular-nums">
                        {formatTime(duration)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto gap-1.5 sm:gap-2 md:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        onClick={handleScreenshot}
                        className="hidden sm:inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition-all hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                        title="截图"
                      >
                        <svg
                          className="w-4 h-4 md:w-[18px] md:h-[18px]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                          />
                        </svg>
                      </button>

                      <div className="hidden md:flex items-center gap-3">
                        <button
                          onClick={handleToggleMute}
                          className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-white/80 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                        >
                          {renderVolumeIcon("w-4 h-4 md:w-5 md:h-5")}
                        </button>
                        <div className="relative h-8 w-20 md:w-24 rounded-full border border-white/10 bg-white/10 overflow-hidden">
                          <div
                            className="absolute inset-y-2 left-2 rounded-full bg-white"
                            style={{
                              width: `calc(${Math.max(volume * 100, 4)}% - 0.5rem)`,
                            }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) =>
                              handleVolumeChange(parseFloat(e.target.value))
                            }
                            className="player-range-hitbox absolute inset-0 opacity-0 cursor-pointer touch-manipulation"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                      <button
                        onClick={handlePip}
                        className="hidden sm:inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition-all hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                        title="画中画"
                      >
                        <svg
                          className="w-4 h-4 md:w-[18px] md:h-[18px]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.5 6.75V12m0 0H18m-4.5 0l4.5 4.5M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                          />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        aria-expanded={showSettings}
                        aria-label={
                          showSettings ? "关闭播放设置" : "打开播放设置"
                        }
                        className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-2.5 text-[11px] font-bold transition-all sm:min-h-[44px] sm:px-3.5 sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${showSettings ? "border-amber-400/30 bg-amber-500/15 text-amber-200 shadow-inner" : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"}`}
                      >
                        <svg
                          className="w-4 h-4 md:w-[18px] md:h-[18px]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-3.75 0h9.75"
                          />
                        </svg>
                        <span className="hidden sm:inline">设置</span>
                      </button>

                      {/* 一起看 */}
                      <WatchTogether
                        seriesId={seriesId}
                        episodeId={episodeId}
                        currentUserId={watchTogetherUserId}
                        currentEmail={watchTogetherEmail}
                        currentTime={currentTime}
                        onSyncPlay={() => {
                          if (artRef.current) artRef.current.play();
                        }}
                        onSyncPause={() => {
                          if (artRef.current) artRef.current.pause();
                        }}
                        onSyncSeek={(time) => {
                          if (artRef.current) {
                            const playerDuration = artRef.current.duration;
                            const safeDuration =
                              isFiniteNumber(playerDuration) && playerDuration > 0
                                ? playerDuration
                                : normalizeNonNegative(duration, 0);
                            const normalizedTime = normalizeNonNegative(time, 0);
                            const safeTime =
                              safeDuration > 0
                                ? clamp(normalizedTime, 0, safeDuration)
                                : normalizedTime;
                            artRef.current.currentTime = safeTime;
                            setCurrentTime(safeTime);
                          }
                        }}
                        onSyncEpisode={(epId) => {
                          router.push(`/play/${seriesId}/${epId}`);
                        }}
                      />

                      <button
                        type="button"
                        onClick={handleToggleFullscreen}
                        aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
                        className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-2.5 text-[11px] font-bold transition-all sm:min-h-[44px] sm:px-3.5 sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${isFullscreen ? "border-amber-500 bg-amber-600 text-white" : "border-amber-500/20 bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-white"}`}
                      >
                        <svg
                          className="w-4 h-4 md:w-[18px] md:h-[18px]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                        </svg>
                        <span className="hidden sm:inline">
                          {isFullscreen ? "退出" : "全屏"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* 弹幕输入栏 */}
      {!error && videoInfo && (
        <div className="relative px-3 sm:px-4 pt-2 pb-1">
          <DanmakuInput
            episodeId={episodeId}
            currentTime={currentTime}
            isFullscreen={isFullscreen}
            settings={danmakuSettings}
            onSettingsChange={handleDanmakuSettingsChange}
            onDanmakuSent={handleDanmakuSent}
          />
        </div>
      )}

      {!isFullscreen && (
        <div className="relative px-3 sm:px-4 pt-1 pb-1">
          <AnimatePresence>
            {videoInfo && !error && (
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="inline-flex"
              >
                <ExternalPlayerLinks
                  url={videoInfo.url}
                  title={videoInfo.title}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
};

export default VideoPlayer;
