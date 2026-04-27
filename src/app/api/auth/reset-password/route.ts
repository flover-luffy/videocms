import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { invalidateAllUserTokens } from "@/lib/auth/token-blacklist";
import { createRateLimiter, RATE_LIMITS } from "@/lib/rate-limit";
import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";

const rateLimiter = createRateLimiter(RATE_LIMITS.auth);

const ResetPasswordSchema = z.object({
  token: z.string().min(1, "重置令牌不能为空"),
  password: z
    .string()
    .min(12, "密码至少需要 12 个字符")
    .regex(/[A-Z]/, "密码必须包含至少一个大写字母")
    .regex(/[0-9]/, "密码必须包含至少一个数字")
    .regex(/[!@#$%^&*]/, "密码必须包含至少一个特殊字符 (!@#$%^&*)"),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * 重置密码
 * POST /api/auth/reset-password
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  // 速率限制
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json().catch(() => null);
  const result = ResetPasswordSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "请求参数无效" },
      { status: 400 },
    );
  }

  const { token, password } = result.data;
  const tokenHash = hashToken(token);

  // 哈希新密码
  const passwordHash = await bcrypt.hash(password, 12);

  const userId = await prisma.$transaction(async (tx) => {
    const updated = await tx.passwordResetToken.updateMany({
      where: {
        token: tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });

    if (updated.count === 0) {
      throw AppError.badRequest("无效或已使用的重置链接");
    }

    const resetToken = await tx.passwordResetToken.findFirst({
      where: { token: tokenHash },
      select: { userId: true },
    });

    if (!resetToken) {
      throw AppError.badRequest("无效或已使用的重置链接");
    }

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    return resetToken.userId;
  });

  // 使该用户的所有旧 token 失效（强制重新登录）
  await invalidateAllUserTokens(userId);

  return NextResponse.json({
    success: true,
    message: "密码重置成功，请使用新密码登录",
  });
});
