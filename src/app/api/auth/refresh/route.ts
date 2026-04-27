import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { withApiHandler } from "@/lib/api-handler";
import { setAuthCookies } from "@/lib/auth/cookies";
import {
  addToBlacklist,
  invalidateAllUserTokens,
  isBlacklisted,
} from "@/lib/auth/token-blacklist";

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
  const payload = await verifyToken(refreshToken, { checkRevocation: false });
  if (!payload || !payload.jti || !payload.exp) {
    return NextResponse.json(
      { error: "刷新令牌已过期或无效" },
      { status: 401 },
    );
  }

  // 检查此刷新令牌是否已被撤销（使用统一的 TokenBlacklist）
  const isRevoked = await isBlacklisted(refreshToken);

  if (isRevoked) {
    // 检测到可疑的盗用行为（用已被注销的 token 继续刷新）
    await invalidateAllUserTokens(payload.userId);
    return NextResponse.json(
      { error: "刷新令牌异常：检测到多次使用" },
      { status: 403 },
    );
  }

  // 将旧 Token 拉黑（reason: token_rotation）
  await addToBlacklist(refreshToken, new Date(payload.exp * 1000), "security");

  // 签发全新的访问与刷新令牌
  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  };

  const newAccessToken = await signAccessToken(tokenPayload);
  const newRefreshToken = await signRefreshToken(tokenPayload);

  const res = NextResponse.json({
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    },
  });

  // 更新双令牌 Cookie
  setAuthCookies(res, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });

  return res;
});
