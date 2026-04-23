import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import bcrypt from "bcryptjs";
import { withApiHandler } from "@/lib/api-handler";
import { LoginSchema } from "@/lib/validation";
import { setAuthCookies } from "@/lib/auth/cookies";
import { AuditLogger } from "@/lib/audit-logger";
import { cacheManager } from "@/lib/cache";

// 获取或创建登录限制缓存实例
const loginAttemptCache = cacheManager.getCache<{ count: number; timestamp: number }>("login-attempts", 5000, 900);

/**
 * 跟踪登录尝试（支持分布式）
 */
async function trackLoginAttempt(ip: string, success: boolean): Promise<void> {
    const key = `login:attempts:${ip}`;
    const maxAttempts = 5;

    if (success) {
        // 成功登录，清除计数器
        await loginAttemptCache.delete(key);
        return;
    }

    // 失败尝试计数
    const existing = await loginAttemptCache.get(key);
    const attempts = (existing?.count ?? 0) + 1;
    
    await loginAttemptCache.set(key, { count: attempts, timestamp: Date.now() }, 900);

    if (attempts >= maxAttempts) {
        throw new Error("尝试次数过多，请 15 分钟后再试");
    }
}

/**
 * 检查登录是否被限制
 */
async function isLoginRateLimited(ip: string): Promise<boolean> {
    const key = `login:attempts:${ip}`;
    const data = await loginAttemptCache.get(key);
    return data !== null && data.count >= 5;
}

export const POST = withApiHandler(async (request: NextRequest) => {
    // 正确处理代理链场景，x-forwarded-for 可能包含多个逗号分隔 IP，取第一个
    const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim();

    // 检查是否已被限制
    let isRateLimited = false;
    try {
        isRateLimited = await isLoginRateLimited(ip);
    } catch (err) {
        console.warn("[Login] 无法检查速率限制", err);
    }

    if (isRateLimited) {
        await AuditLogger.logLoginAttempt("unknown", ip, false, "登录尝试过多");
        return NextResponse.json({ error: "尝试次数过多，请 15 分钟后再试" }, { status: 429 });
    }

    const json = await request.json().catch(() => null);
    const result = LoginSchema.safeParse(json);

    if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }
    const { email, password } = result.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        try {
            await trackLoginAttempt(ip, false);
        } catch (err) {
            console.warn("[Login] 无法记录登录尝试", err);
        }
        await AuditLogger.logLoginAttempt(email, ip, false, "用户不存在");
        return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        try {
            await trackLoginAttempt(ip, false);
        } catch (err) {
            console.warn("[Login] 无法记录登录尝试", err);
        }
        await AuditLogger.logLoginAttempt(email, ip, false, "密码错误");
        return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    // 成功登录
    try {
        await trackLoginAttempt(ip, true);
    } catch (err) {
        console.warn("[Login] 无法清除登录计数", err);
    }
    await AuditLogger.logLoginAttempt(email, ip, true);

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(tokenPayload),
        signRefreshToken(tokenPayload),
    ]);

    const res = NextResponse.json({
        user: { id: user.id, email: user.email, role: user.role },
    });

    // 统一写入双 Token HttpOnly Cookie
    setAuthCookies(res, { accessToken, refreshToken });

    return res;
});
