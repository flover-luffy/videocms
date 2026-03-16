import { LRUCache } from "lru-cache";
import { prisma } from "@/lib/db";

/**
 * Token 黑名单管理
 * 用于强制登出、密码重置后使旧 token 失效
 */

declare global {
    var tokenBlacklist: LRUCache<string, boolean> | undefined;
}

// 内存黑名单缓存（用于快速查询）
// 生产环境建议使用 Redis
const tokenBlacklist = globalThis.tokenBlacklist || new LRUCache<string, boolean>({
    max: 10000,
    ttl: 1000 * 60 * 60 * 24 * 7, // 7 天（与 refresh token 过期时间一致）
});

if (process.env.NODE_ENV !== "production") {
    globalThis.tokenBlacklist = tokenBlacklist;
}

/**
 * 将 token 加入黑名单
 * @param token JWT token
 * @param reason 加入黑名单的原因
 */
export async function addToBlacklist(token: string, reason: string = "logout"): Promise<void> {
    // 1. 加入内存缓存
    tokenBlacklist.set(token, true);

    // 2. 持久化到数据库（可选，用于多实例部署）
    try {
        await prisma.tokenBlacklist.create({
            data: {
                token,
                reason,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天后过期
            },
        });
    } catch (error) {
        // 如果数据库写入失败，至少内存缓存已生效
        console.error("[TokenBlacklist] 数据库写入失败:", error);
    }
}

/**
 * 检查 token 是否在黑名单中
 * @param token JWT token
 * @returns true 表示在黑名单中（已失效）
 */
export async function isBlacklisted(token: string): Promise<boolean> {
    // 1. 先检查内存缓存（快速路径）
    if (tokenBlacklist.has(token)) {
        return true;
    }

    // 2. 检查数据库（慢速路径，用于多实例部署）
    try {
        const record = await prisma.tokenBlacklist.findUnique({
            where: { token },
            select: { id: true },
        });

        if (record) {
            // 同步到内存缓存
            tokenBlacklist.set(token, true);
            return true;
        }
    } catch (error) {
        console.error("[TokenBlacklist] 数据库查询失败:", error);
    }

    return false;
}

/**
 * 清理过期的黑名单记录（定时任务调用）
 */
export async function cleanupExpiredTokens(): Promise<number> {
    try {
        const result = await prisma.tokenBlacklist.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        });
        return result.count;
    } catch (error) {
        console.error("[TokenBlacklist] 清理失败:", error);
        return 0;
    }
}

/**
 * 使用户的所有 token 失效（用于密码重置、账号被封禁等场景）
 * @param userId 用户 ID
 */
export async function invalidateAllUserTokens(userId: number): Promise<void> {
    try {
        // 记录用户的 token 失效时间
        await prisma.user.update({
            where: { id: userId },
            data: {
                tokenInvalidatedAt: new Date(),
            },
        });
    } catch (error) {
        console.error("[TokenBlacklist] 用户 token 失效失败:", error);
        throw error;
    }
}

/**
 * 检查用户的 token 是否在失效时间之前签发（已失效）
 * @param userId 用户 ID
 * @param tokenIssuedAt token 签发时间（从 JWT payload 获取）
 * @returns true 表示 token 已失效
 */
export async function isTokenInvalidatedForUser(
    userId: number,
    tokenIssuedAt: number
): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tokenInvalidatedAt: true },
        });

        if (!user?.tokenInvalidatedAt) {
            return false;
        }

        // 如果 token 签发时间早于失效时间，则 token 已失效
        const invalidatedTimestamp = Math.floor(user.tokenInvalidatedAt.getTime() / 1000);
        return tokenIssuedAt < invalidatedTimestamp;
    } catch (error) {
        console.error("[TokenBlacklist] 检查用户 token 失效状态失败:", error);
        return false;
    }
}
