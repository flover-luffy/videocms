import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import bcrypt from "bcryptjs";
import { withApiHandler } from "@/lib/api-handler";
import { LoginSchema } from "@/lib/validation";
import { setAuthCookies } from "@/lib/auth/cookies";
import { AuditLogger } from "@/lib/audit-logger";

import { LRUCache } from "lru-cache";

// 使用 LRUCache 替代简单 Map，防范内存泄漏与简单遍历攻击
// 限制 5000 个独立 IP，每个条目 15 分钟过期
const loginAttempts = new LRUCache<string, { count: number; lastTime: number }>({
    max: 5000,
    ttl: 15 * 60 * 1000,
});

export const POST = withApiHandler(async (request: NextRequest) => {
    // 正确处理代理链场景，x-forwarded-for 可能包含多个逗号分隔 IP，取第一个
    const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
    const now = Date.now();
    const attempt = loginAttempts.get(ip) || { count: 0, lastTime: now };

    // 10 分钟内超过 5 次失败，封禁
    if (attempt.count >= 5 && now - attempt.lastTime < 15 * 60 * 1000) {
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
        await AuditLogger.logLoginAttempt(email, ip, false, "用户不存在");
        return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        // 记录失败次数
        attempt.count += 1;
        attempt.lastTime = now;
        loginAttempts.set(ip, attempt);
        await AuditLogger.logLoginAttempt(email, ip, false, "密码错误");
        return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    // 成功登录，清除拦截
    loginAttempts.delete(ip);
    await AuditLogger.logLoginAttempt(email, ip, true);

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(tokenPayload),
        signRefreshToken(tokenPayload),
    ]);

    const res = NextResponse.json({
        accessToken,
        user: { id: user.id, email: user.email, role: user.role },
    });

    // 统一写入双 Token HttpOnly Cookie
    setAuthCookies(res, { accessToken, refreshToken });

    return res;
});
