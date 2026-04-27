import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import bcrypt from "bcryptjs";
import { withApiHandler } from "@/lib/api-handler";
import { RegisterSchema } from "@/lib/validation";
import { setAuthCookies } from "@/lib/auth/cookies";
import { createRateLimiter, RATE_LIMITS } from "@/lib/rate-limit";

const rateLimiter = createRateLimiter(RATE_LIMITS.auth);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * 用户注册 API
 * POST /api/auth/register
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const json = await request.json().catch(() => null);
  const result = RegisterSchema.safeParse(json);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }
  const { email, password } = result.data;

  // 1. 检查是否存在
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "注册失败，请检查邮箱或验证码" },
      { status: 400 },
    );
  }

  // 2. 校验验证码
  const codeHash = hashToken(result.data.code);
  const validToken = await prisma.verificationToken.findFirst({
    where: {
      email,
      token: codeHash,
      expiresAt: { gt: new Date() },
    },
  });

  if (!validToken) {
    return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
  }

  // 验证成功，立马废弃该验证码
  await prisma.verificationToken.delete({ where: { id: validToken.id } });

  // 3. 创建用户（安全固定：注册只能创建普通用户，管理员需通过后台提权）
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);

  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
    },
  });

  // 4. 签发 Token
  const tokenPayload = {
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
  };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ]);

  const res = NextResponse.json({
    user: { id: newUser.id, email: newUser.email, role: newUser.role },
  });

  // 5. 统一写入双 Token HttpOnly Cookie（与 login 行为一致）
  setAuthCookies(res, { accessToken, refreshToken });

  return res;
});
