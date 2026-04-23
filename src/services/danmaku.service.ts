import { prisma } from "@/lib/db";
import { cacheManager } from "@/lib/cache";
import { AppError } from "@/lib/errors";

// ── 弹幕类型定义 ──────────────────────────────────
/** 弹幕类型枚举：0=滚动, 1=顶部固定, 2=底部固定 */
type DanmakuType = 0 | 1 | 2;

/** 从数据库/缓存中读取的弹幕条目 */
export interface DanmakuItem {
  id: number;
  text: string;
  time: number;
  color: string;
  type: DanmakuType;
  fontSize: number;
}

/** 创建弹幕的请求参数 */
export interface CreateDanmakuInput {
  episodeId: number;
  text: string;
  time: number;
  color?: string;
  type?: DanmakuType;
  fontSize?: number;
  userId?: number;
}

// ── 弹幕缓存（Redis 热点读取优化） ──────────────────
interface DanmakuCacheEntry {
  items: DanmakuItem[];
  cachedAt: number;
}

const danmakuCache = cacheManager.getCache<DanmakuCacheEntry>(
  "danmaku",
  500,
  600, // 缓存 10 分钟
);

// ── 频率限制（防止弹幕刷屏） ──────────────────────
interface RateLimitRecord {
  count: number;
  windowStart: number;
}

const rateLimitCache = cacheManager.getCache<RateLimitRecord>(
  "danmaku-rate",
  10000,
  60,
);

/** 每个用户每分钟最多发送的弹幕数量 */
const MAX_DANMAKU_PER_MINUTE = 10;

// ── 内容安全 ──────────────────────────────────────
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/** 弹幕文本基本清洗（过滤控制字符、超长文本） */
function sanitizeDanmakuText(text: string): string {
  return text
    .replace(/[\x00-\x1F\x7F]/g, "") // 移除控制字符
    .replace(/\s+/g, " ") // 合并连续空白
    .trim()
    .slice(0, 200); // 强制截断 200 字
}

// ── 服务实现 ──────────────────────────────────────
export class DanmakuService {
  /**
   * 获取指定集数的全部弹幕
   * 优先从 Redis/内存缓存读取，缓存未命中时回源数据库
   */
  static async getByEpisode(episodeId: number): Promise<DanmakuItem[]> {
    const cacheKey = `ep:${episodeId}`;

    const cached = await danmakuCache.get(cacheKey);
    if (cached) {
      return cached.items;
    }

    const rows = await prisma.danmaku.findMany({
      where: { episodeId },
      select: {
        id: true,
        text: true,
        time: true,
        color: true,
        type: true,
        fontSize: true,
      },
      orderBy: { time: "asc" },
    });

    const items: DanmakuItem[] = rows.map((r) => ({
      id: r.id,
      text: r.text,
      time: r.time,
      color: r.color,
      type: r.type as DanmakuType,
      fontSize: r.fontSize,
    }));

    // 写入缓存
    await danmakuCache.set(cacheKey, { items, cachedAt: Date.now() });

    return items;
  }

  /**
   * 发送弹幕
   * 包含频率限制、内容校验、缓存失效
   */
  static async create(input: CreateDanmakuInput): Promise<DanmakuItem> {
    // 1. 参数校验
    const cleanText = sanitizeDanmakuText(input.text);
    if (!cleanText || cleanText.length < 1) {
      throw AppError.badRequest("弹幕内容不能为空");
    }
    if (input.time < 0) {
      throw AppError.badRequest("弹幕时间不能为负数");
    }
    if (input.color && !HEX_COLOR_REGEX.test(input.color)) {
      throw AppError.badRequest("弹幕颜色格式错误，请使用 #RRGGBB 格式");
    }
    const danmakuType: DanmakuType =
      input.type !== undefined && [0, 1, 2].includes(input.type)
        ? input.type
        : 0;

    // 2. 频率限制（基于 userId 或 IP，这里以 userId 为主键）
    if (input.userId) {
      await this.enforceRateLimit(input.userId);
    }

    // 3. 验证 episode 存在
    const episode = await prisma.episode.findUnique({
      where: { id: input.episodeId },
      select: { id: true },
    });
    if (!episode) {
      throw AppError.notFound("指定的集数不存在");
    }

    // 4. 写入数据库
    const created = await prisma.danmaku.create({
      data: {
        episodeId: input.episodeId,
        text: cleanText,
        time: input.time,
        color: input.color || "#FFFFFF",
        type: danmakuType,
        fontSize: input.fontSize ?? 25,
        userId: input.userId ?? null,
      },
      select: {
        id: true,
        text: true,
        time: true,
        color: true,
        type: true,
        fontSize: true,
      },
    });

    // 5. 失效该集的弹幕缓存
    await danmakuCache.delete(`ep:${input.episodeId}`);

    return {
      id: created.id,
      text: created.text,
      time: created.time,
      color: created.color,
      type: created.type as DanmakuType,
      fontSize: created.fontSize,
    };
  }

  /**
   * 频率限制检查
   * 每个用户每分钟最多发送 MAX_DANMAKU_PER_MINUTE 条弹幕
   */
  private static async enforceRateLimit(userId: number): Promise<void> {
    const rateLimitKey = `user:${userId}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 分钟窗口

    const record = await rateLimitCache.get(rateLimitKey);

    if (record && now - record.windowStart < windowMs) {
      if (record.count >= MAX_DANMAKU_PER_MINUTE) {
        throw AppError.tooManyRequests(
          `弹幕发送过于频繁，每分钟最多 ${MAX_DANMAKU_PER_MINUTE} 条`,
        );
      }
      // 递增计数
      await rateLimitCache.set(
        rateLimitKey,
        { count: record.count + 1, windowStart: record.windowStart },
        60,
      );
    } else {
      // 开启新窗口
      await rateLimitCache.set(
        rateLimitKey,
        { count: 1, windowStart: now },
        60,
      );
    }
  }

  /**
   * 获取弹幕总数统计（用于管理后台）
   */
  static async getCountByEpisode(episodeId: number): Promise<number> {
    return prisma.danmaku.count({ where: { episodeId } });
  }
}
