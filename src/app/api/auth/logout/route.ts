import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";

/**
 * 用户退出登录 API
 * POST /api/auth/logout
 */
export const POST = withApiHandler(async (request: NextRequest) => {
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (refreshToken) {
        const payload = await verifyToken(refreshToken);
        // 若 Token 并未过期且存在 JTI，则主动加入黑名单
        if (payload && payload.jti && payload.exp) {
            await prisma.revokedToken.upsert({
                where: { jti: payload.jti },
                update: {},
                create: {
                    jti: payload.jti,
                    expiresAt: new Date(payload.exp * 1000)
                }
            }).catch(() => { /* 忽略重复插入错误 */ });
        }
    }

    const res = NextResponse.json({ success: true });
    // 清除 HttpOnly Cookie
    res.cookies.set("refresh_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
    });
    res.cookies.set("access_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
    });
    return res;
});
