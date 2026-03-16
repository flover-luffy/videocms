import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { verifyToken } from "@/lib/auth/jwt";
import { addToBlacklist } from "@/lib/auth/token-blacklist";

/**
 * 用户退出登录 API
 * POST /api/auth/logout
 */
export const POST = withApiHandler(async (request: NextRequest) => {
    const accessToken = request.cookies.get("access_token")?.value;
    const refreshToken = request.cookies.get("refresh_token")?.value;

    // 将 access token 和 refresh token 都加入黑名单
    if (accessToken) {
        await addToBlacklist(accessToken, "logout").catch(() => {
            // 忽略错误，继续处理
        });
    }

    if (refreshToken) {
        await addToBlacklist(refreshToken, "logout").catch(() => {
            // 忽略错误，继续处理
        });
    }

    const res = NextResponse.json({ success: true, message: "登出成功" });
    
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

