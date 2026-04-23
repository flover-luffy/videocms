"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";

// ── 弹幕数据类型 ──────────────────────────────────
export interface DanmakuData {
  id: number;
  text: string;
  time: number; // 出现时间（秒）
  color: string; // 十六进制颜色
  type: number; // 0=滚动, 1=顶部, 2=底部
  fontSize: number;
}

/** 弹幕渲染设置 */
export interface DanmakuSettings {
  enabled: boolean;
  opacity: number; // 0~1
  speed: number; // 弹幕速度倍率 0.5~2.0
  fontSize: number; // 字体大小缩放因子 0.5~2.0
  area: number; // 弹幕显示区域比例 0.25~1.0
}

const DEFAULT_SETTINGS: DanmakuSettings = {
  enabled: true,
  opacity: 0.85,
  speed: 1.0,
  fontSize: 1.0,
  area: 0.75,
};

// ── 内部渲染状态 ──────────────────────────────────
interface ActiveDanmaku {
  id: number;
  text: string;
  color: string;
  fontSize: number;
  type: number;
  x: number; // 当前 X 坐标（滚动弹幕用）
  y: number; // Y 坐标（轨道位置）
  width: number; // 渲染后文本宽度
  startTime: number; // 动画开始时间 (ms)
  duration: number; // 动画总持续时间 (ms)
}

// ── 弹幕轨道管理 ──────────────────────────────────
const TRACK_HEIGHT = 32; // 每条轨道高度(px)
const SCROLL_DURATION_BASE = 8000; // 滚动弹幕基准持续时间(ms)
const FIXED_DURATION = 5000; // 固定弹幕持续时间(ms)

interface DanmakuLayerProps {
  danmakus: DanmakuData[];
  currentTime: number; // 当前播放时间（秒）
  isPlaying: boolean;
  containerWidth: number;
  containerHeight: number;
  settings?: Partial<DanmakuSettings>;
  /** 新弹幕实时推入（用户自己发送的弹幕立即显示） */
  realtimeDanmaku?: DanmakuData | null;
}

/**
 * 弹幕渲染层 — 基于 Canvas 的高性能弹幕引擎
 *
 * 技术方案：
 * - 使用 requestAnimationFrame 驱动 Canvas 2D 渲染
 * - 按视频时间轴触发弹幕，支持快进/快退重新定位
 * - 轨道碰撞检测，避免弹幕重叠
 */
const DanmakuLayer: React.FC<DanmakuLayerProps> = ({
  danmakus,
  currentTime,
  isPlaying,
  containerWidth,
  containerHeight,
  settings: settingsOverride,
  realtimeDanmaku,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<ActiveDanmaku[]>([]);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const trackOccupancy = useRef<Map<number, number>>(new Map());

  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...settingsOverride }),
    [settingsOverride],
  );

  // 已排序的弹幕索引，用于高效时间窗口查找
  const sortedDanmakus = useMemo(
    () => [...danmakus].sort((a, b) => a.time - b.time),
    [danmakus],
  );

  const lastIndexRef = useRef(0);

  // 计算实际轨道数
  const maxTracks = useMemo(() => {
    const areaHeight = containerHeight * settings.area;
    return Math.max(1, Math.floor(areaHeight / TRACK_HEIGHT));
  }, [containerHeight, settings.area]);

  /** 寻找可用的轨道（避免碰撞） */
  const findAvailableTrack = useCallback(
    (type: number, now: number): number => {
      const startTrack = type === 2 ? maxTracks - 1 : 0;
      const endTrack = type === 2 ? -1 : maxTracks;
      const step = type === 2 ? -1 : 1;

      for (let t = startTrack; t !== endTrack; t += step) {
        const occupied = trackOccupancy.current.get(t) || 0;
        if (now >= occupied) {
          return t;
        }
      }
      // 所有轨道都被占用，随机分配一个
      return Math.floor(Math.random() * maxTracks);
    },
    [maxTracks],
  );

  /** 将弹幕数据激活为渲染对象 */
  const activateDanmaku = useCallback(
    (d: DanmakuData, now: number) => {
      const realFontSize = Math.round(d.fontSize * settings.fontSize);
      const track = findAvailableTrack(d.type, now);

      // 预估文本宽度
      const estimatedWidth = d.text.length * realFontSize * 0.6;
      const scrollDuration = SCROLL_DURATION_BASE / settings.speed;

      // 标记轨道占用（滚动弹幕需要考虑尾部间隔）
      if (d.type === 0) {
        // 滚动弹幕：等到文本完全进入后再释放轨道
        const entryTime = (estimatedWidth / (containerWidth + estimatedWidth)) * scrollDuration;
        trackOccupancy.current.set(track, now + entryTime + 200);
      } else {
        // 固定弹幕：占用整个持续时间
        trackOccupancy.current.set(track, now + FIXED_DURATION);
      }

      const active: ActiveDanmaku = {
        id: d.id,
        text: d.text,
        color: d.color,
        fontSize: realFontSize,
        type: d.type,
        x: d.type === 0 ? containerWidth : (containerWidth - estimatedWidth) / 2,
        y: track * TRACK_HEIGHT + TRACK_HEIGHT * 0.8,
        width: estimatedWidth,
        startTime: now,
        duration: d.type === 0 ? scrollDuration : FIXED_DURATION,
      };

      activeRef.current.push(active);
    },
    [containerWidth, settings.fontSize, settings.speed, findAvailableTrack],
  );

  // 实时弹幕推入
  useEffect(() => {
    if (!realtimeDanmaku) return;
    activateDanmaku(realtimeDanmaku, performance.now());
  }, [realtimeDanmaku, activateDanmaku]);

  // 时间跳变检测：快进/快退时清空当前渲染池并重新定位
  useEffect(() => {
    const timeDiff = Math.abs(currentTime - lastTimeRef.current);
    if (timeDiff > 2) {
      // 发生了跳变（快进/快退）
      activeRef.current = [];
      trackOccupancy.current.clear();

      // 重新定位弹幕索引 — 二分查找
      let lo = 0;
      let hi = sortedDanmakus.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (sortedDanmakus[mid].time < currentTime) {
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      lastIndexRef.current = lo;
    }
    lastTimeRef.current = currentTime;
  }, [currentTime, sortedDanmakus]);

  // 主渲染循环
  useEffect(() => {
    if (!settings.enabled || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const now = performance.now();

      // 1. 触发时间窗口内的新弹幕
      while (
        lastIndexRef.current < sortedDanmakus.length &&
        sortedDanmakus[lastIndexRef.current].time <= currentTime
      ) {
        // 只激活当前时间窗口内（±0.5 秒）的弹幕，太旧的跳过
        const d = sortedDanmakus[lastIndexRef.current];
        if (currentTime - d.time < 0.5) {
          activateDanmaku(d, now);
        }
        lastIndexRef.current++;
      }

      // 2. 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = settings.opacity;

      // 3. 更新和渲染活跃弹幕
      const stillActive: ActiveDanmaku[] = [];

      for (const dm of activeRef.current) {
        const elapsed = now - dm.startTime;
        if (elapsed > dm.duration) continue; // 已过期

        // 计算当前位置
        if (dm.type === 0) {
          // 滚动弹幕：从右到左
          const progress = elapsed / dm.duration;
          dm.x = containerWidth - progress * (containerWidth + dm.width);
        }
        // 固定弹幕：x 不变（居中）

        // 渲染
        ctx.font = `bold ${dm.fontSize}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
        ctx.fillStyle = dm.color;
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(dm.text, dm.x, dm.y);

        stillActive.push(dm);
      }

      // 重置阴影避免影响后续绘制
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.globalAlpha = 1;

      activeRef.current = stillActive;

      if (isPlaying) {
        rafRef.current = requestAnimationFrame(render);
      }
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    isPlaying,
    settings.enabled,
    settings.opacity,
    containerWidth,
    currentTime,
    sortedDanmakus,
    activateDanmaku,
  ]);

  // Canvas 尺寸同步
  const [dpr] = useState(() =>
    typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  );

  if (!settings.enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      width={containerWidth * dpr}
      height={containerHeight * dpr}
      className="absolute inset-0 pointer-events-none z-[50]"
      style={{
        width: containerWidth,
        height: containerHeight,
        transform: `scale(${1 / dpr})`,
        transformOrigin: "top left",
      }}
      aria-hidden="true"
    />
  );
};

export default DanmakuLayer;
export { DEFAULT_SETTINGS as DANMAKU_DEFAULT_SETTINGS };
