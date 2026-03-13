import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { withApiHandler } from "@/lib/api-handler";
import { setAuthCookies } from "@/lib/auth/cookies";
import { prisma } from "@/lib/db";

/**
 * 令牌刷新端点
 * POST /api/auth/refresh
 * 使用刷新令牌获取新的访问令牌和新的刷新令牌 (Token Rotation)
 */
export const POST = withApiHandler(async (request: NextRequest) => {
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (!refreshToken) {
        return NextResponse.json({ error: "未提供刷新令牌" }, { status: 401 });
    }

    // 验证刷新令牌
    const payload = await verifyToken(refreshToken);
    if (!payload || !payload.jti || !payload.exp) {
        return NextResponse.json({ error: "刷新令牌已过期或无效" }, { status: 401 });
    }

    // 检查此刷新令牌的 JTI 是否处于黑名单中
    const isRevoked = await prisma.revokedToken.findUnique({
        where: { jti: payload.jti }
    });

    if (isRevoked) {
        // Todo: 这里检测到了可疑的盗用行为（用已被注销的 token 继续刷新），出于安全性可以考虑清空当前用户的所有 Token 等激进做法
        return NextResponse.json({ error: "刷新令牌异常：检测到多次使用" }, { status: 403 });
    }

    // 将旧 Token 拉黑 (过期时间设置为 JWT 自身声明的过期时间，方便定时清理脚本回收数据库)
    await prisma.revokedToken.create({
        data: {
            jti: payload.jti,
            expiresAt: new Date(payload.exp * 1000)
        }
    });

    // 签发全新的访问与刷新令牌
    const tokenPayload = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
    };

    const newAccessToken = await signAccessToken(tokenPayload);
    const newRefreshToken = await signRefreshToken(tokenPayload);

    const res = NextResponse.json({
        accessToken: newAccessToken,
        user: {
            id: payload.userId,
            email: payload.email,
            role: payload.role,
        },
    });

    // 更新双令牌 Cookie
    setAuthCookies(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });

    return res;
});
