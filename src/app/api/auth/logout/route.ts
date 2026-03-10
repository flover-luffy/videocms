import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";

/**
 * 用户退出登录 API
 * POST /api/auth/logout
 */
export const POST = withApiHandler(async () => {
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
