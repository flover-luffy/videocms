import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signAccessToken } from "@/lib/auth/jwt";
import { withApiHandler } from "@/lib/api-handler";
import { setAuthCookies } from "@/lib/auth/cookies";

/**
 * 令牌刷新端点
 * POST /api/auth/refresh
 * 使用刷新令牌获取新的访问令牌
 */
export const POST = withApiHandler(async (request: NextRequest) => {
    const refreshToken = request.cookies.get("refresh_token")?.value;
    
    if (!refreshToken) {
        return NextResponse.json({ error: "未提供刷新令牌" }, { status: 401 });
    }

    // 验证刷新令牌
    const payload = await verifyToken(refreshToken);
    if (!payload) {
        return NextResponse.json({ error: "刷新令牌已过期或无效" }, { status: 401 });
    }

    // 签发新的访问令牌
    const newAccessToken = await signAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
    });

    const res = NextResponse.json({
        accessToken: newAccessToken,
        user: {
            id: payload.userId,
            email: payload.email,
            role: payload.role,
        },
    });

    // 更新访问令牌 Cookie
    setAuthCookies(res, { accessToken: newAccessToken, refreshToken });

    return res;
});
