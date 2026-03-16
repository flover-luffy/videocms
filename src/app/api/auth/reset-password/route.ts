import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { invalidateAllUserTokens } from "@/lib/auth/token-blacklist";
import { createRateLimiter, RATE_LIMITS } from "@/lib/rate-limit";

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

/**
 * 重置密码
 * POST /api/auth/reset-password
 */
export const POST = withApiHandler(async (request: NextRequest) => {
    // 速率限制
    const rateLimitResponse = rateLimiter(request);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const result = ResetPasswordSchema.safeParse(body);

    if (!result.success) {
        return NextResponse.json(
            { error: result.error.issues[0].message },
            { status: 400 }
        );
    }

    const { token, password } = result.data;

    // 查找重置令牌
    const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
    });

    // 验证令牌
    if (!resetToken) {
        return NextResponse.json(
            { error: "无效的重置链接" },
            { status: 400 }
        );
    }

    if (resetToken.used) {
        return NextResponse.json(
            { error: "此重置链接已被使用" },
            { status: 400 }
        );
    }

    if (new Date() > resetToken.expiresAt) {
        return NextResponse.json(
            { error: "重置链接已过期，请重新申请" },
            { status: 400 }
        );
    }

    // 哈希新密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 更新密码并标记令牌为已使用
    await prisma.$transaction([
        // 更新密码
        prisma.user.update({
            where: { id: resetToken.userId },
            data: { passwordHash },
        }),
        // 标记令牌为已使用
        prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { used: true },
        }),
    ]);

    // 使该用户的所有旧 token 失效（强制重新登录）
    await invalidateAllUserTokens(resetToken.userId);

    return NextResponse.json({
        success: true,
        message: "密码重置成功，请使用新密码登录",
    });
});
