import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { withApiHandler } from "@/lib/api-handler";

/**
 * 获取当前用户信息（使用 access_token）
 * GET /api/auth/me
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const accessToken =
    request.cookies.get("access_token")?.value ||
    request.headers.get("Authorization")?.split(" ")[1];

  if (!accessToken) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const payload = await verifyToken(accessToken);

  if (!payload) {
    return NextResponse.json(
      { error: "Token 失效，请重新登录" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    },
  });
});
