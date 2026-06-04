import { LRUCache } from "lru-cache";
import { prisma } from "@/lib/db";
import { cacheManager } from "@/lib/cache";
import logger from "@/lib/logger";

/**
 * Token 黑名单管理 (单体部署优化版)
 * 用于强制登出、密码重置后使旧 token 失效
 * 内存缓存 + 数据库持久化，不依赖 Redis
 */

declare global {
  var tokenBlacklist: LRUCache<string, boolean> | undefined;
}

// 内存黑名单缓存（快速查询）
// 单体部署：足够的缓存容量，避免频繁数据库查询
const tokenBlacklist =
  globalThis.tokenBlacklist ||
  new LRUCache<string, boolean>({
    max: 50000, // 增加容量，支持更多 token
    ttl: 1000 * 60 * 60 * 24 * 7, // 7 天（与 refresh token 过期时间一致）
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.tokenBlacklist = tokenBlacklist;
}

const shouldUseBlacklistDb = process.env.NODE_ENV !== "test";
const distributedBlacklistCache = cacheManager.getCache<{ blacklisted: true }>(
  "token-blacklist",
  50000,
  7 * 24 * 60 * 60,
);

/**
 * 应用启动时初始化：从数据库加载过期的黑名单记录
 * 确保单体部署重启后黑名单有效性保持
 */
export async function initializeTokenBlacklist(): Promise<void> {
  if (!shouldUseBlacklistDb) return;

  try {
    logger.info("[Token Blacklist] 初始化：从数据库加载黑名单...");

    const unexpiredList = await prisma.tokenBlacklist.findMany({
      where: {
        expiresAt: {
          gt: new Date(), // 只加载未过期的记录
        },
      },
      select: { token: true },
    });

    // 加载到内存缓存
    for (const record of unexpiredList) {
      tokenBlacklist.set(record.token, true);
    }

    logger.info(
      `[Token Blacklist] 初始化完成，加载了 ${unexpiredList.length} 条黑名单记录`,
    );
  } catch (error) {
    console.error("[Token Blacklist] 初始化失败:", error);
    // 初始化失败时继续启动，只是 token 列表为空
  }
}

/**
 * 将 token 加入黑名单
 * @param token JWT token
 * @param expiresAt token 的过期时间（从 JWT 的 exp claim 获取）
 * @param reason 加入黑名单的原因
 */
export async function addToBlacklist(
  token: string,
  reason?: string,
): Promise<void>;
export async function addToBlacklist(
  token: string,
  expiresAt: Date | undefined,
  reason?: string,
): Promise<void>;
export async function addToBlacklist(
  token: string,
  expiresAtOrReason?: Date | string,
  reason: string = "logout",
): Promise<void> {
  if (!token) return;

  const expiresAt =
    expiresAtOrReason instanceof Date ? expiresAtOrReason : undefined;
  const resolvedReason =
    typeof expiresAtOrReason === "string" ? expiresAtOrReason : reason;

  // 1. 加入内存缓存
  tokenBlacklist.set(token, true);
  const ttlSeconds = Math.max(
    1,
    Math.floor(
      ((expiresAtOrReason instanceof Date
        ? expiresAtOrReason.getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000) -
        Date.now()) /
        1000,
    ),
  );
  await distributedBlacklistCache.set(token, { blacklisted: true }, ttlSeconds);

  if (!shouldUseBlacklistDb) return;

  // 2. 持久化到数据库（确保重启后仍有效）
  try {
    const defaultExpiry =
      expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.tokenBlacklist.upsert({
      where: { token },
      create: {
        token,
        reason: resolvedReason,
        expiresAt: defaultExpiry,
      },
      update: {
        reason: resolvedReason,
        expiresAt: defaultExpiry,
      },
    });
  } catch (error) {
    // 如果数据库写入失败，至少内存缓存已生效
    console.error("[Token Blacklist] 数据库写入失败:", error);
  }
}

/**
 * 检查 token 是否在黑名单中
 * @param token JWT token
 * @returns true 表示在黑名单中（已失效）
 */
export async function isBlacklisted(token: string): Promise<boolean> {
  if (!token) return false;

  // 1. 先检查内存缓存（快速路径）
  if (tokenBlacklist.has(token)) {
    return true;
  }

  const cached = await distributedBlacklistCache.get(token);
  if (cached?.blacklisted) {
    tokenBlacklist.set(token, true);
    return true;
  }

  if (!shouldUseBlacklistDb) {
    return false;
  }

  // 2. 检查数据库（从来未在内存缓存中的 token，如：重启后的旧登出 token）
  try {
    const record = await prisma.tokenBlacklist.findUnique({
      where: { token },
      select: { id: true, expiresAt: true },
    });

    if (record) {
      // 同步到内存缓存（后续查询会直接命中内存）
      tokenBlacklist.set(token, true);
      const ttlSeconds = Math.max(
        1,
        Math.floor((record.expiresAt.getTime() - Date.now()) / 1000),
      );
      await distributedBlacklistCache.set(token, { blacklisted: true }, ttlSeconds);
      return true;
    }
  } catch (error) {
    console.error("[Token Blacklist] 数据库查询失败:", error);
    // 认证撤销状态无法确认时失败关闭，避免已撤销 token 被放行。
    return true;
  }

  return false;
}

/**
 * 清理过期的黑名单记录（定时任务调用）
 * 应该每天运行一次，避免数据库无限增长
 */
export async function cleanupExpiredTokens(): Promise<number> {
  if (!shouldUseBlacklistDb) return 0;

  try {
    const result = await prisma.tokenBlacklist.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info(`[Token Blacklist] 清理了 ${result.count} 条过期黑名单记录`);
    return result.count;
  } catch (error) {
    console.error("[Token Blacklist] 清理失败:", error);
    return 0;
  }
}

/**
 * 使用户的所有 token 失效（用于密码重置、账号被禁用等场景）
 * @param userId 用户 ID
 */
export async function invalidateAllUserTokens(userId: number): Promise<void> {
  try {
    // 更新用户的 token 失效时间
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        tokenInvalidatedAt: new Date(),
      },
    });

    logger.info(
      `[Token Blacklist] 用户 ${userId} 的所有 token 已失效(在 ${user.tokenInvalidatedAt})`,
    );
  } catch (error) {
    console.error("[Token Blacklist] 用户 token 失效设置失败:", error);
    throw error;
  }
}

/**
 * 检查用户的 token 是否在失效时间之前签发（已失效）
 * @param userId 用户 ID
 * @param tokenIssuedAt token 签发时间（从 JWT payload 的 iat claim 获取）
 * @returns true 表示 token 已失效
 */
export async function isTokenInvalidatedForUser(
  userId: number,
  tokenIssuedAt: number,
): Promise<boolean> {
  if (!shouldUseBlacklistDb) {
    return false;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenInvalidatedAt: true },
    });

    if (!user?.tokenInvalidatedAt) {
      return false;
    }

    // 如果 token 签发时间早于失效时间，则 token 已失效
    const invalidatedTimestamp = Math.floor(
      user.tokenInvalidatedAt.getTime() / 1000,
    );
    return tokenIssuedAt < invalidatedTimestamp;
  } catch (error) {
    console.error("[Token Blacklist] 检查用户 token 失效状态失败:", error);
    // 认证撤销状态无法确认时失败关闭。
    return true;
  }
}
