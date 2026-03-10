import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { withApiHandler } from "@/lib/api-handler";

/**
 * 获取当前用户信息（通过 HttpOnly 的 refresh_token 定位，降低前端逻辑复杂度）
 * GET /api/auth/me
 */
export const GET = withApiHandler(async (request: NextRequest) => {
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (!refreshToken) {
        return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const payload = await verifyToken(refreshToken);

    if (!payload) {
        return NextResponse.json({ error: "Token 失效，请重新登录" }, { status: 401 });
    }

    return NextResponse.json({
        user: {
            id: payload.userId,
            email: payload.email,
            role: payload.role,
        },
    });
});
