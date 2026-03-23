import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { z } from "zod";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { createRateLimiter, RATE_LIMITS } from "@/lib/rate-limit";

const rateLimiter = createRateLimiter(RATE_LIMITS.auth);

const ForgotPasswordSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
});

/**
 * 忘记密码 - 发送重置链接
 * POST /api/auth/forgot-password
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  // 速率限制
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const result = ForgotPasswordSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  const { email } = result.data;

  // 查找用户
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  // 安全考虑：无论用户是否存在，都返回成功消息（防止邮箱枚举）
  if (!user) {
    return NextResponse.json({
      success: true,
      message: "如果该邮箱已注册，您将收到密码重置链接",
    });
  }

  // 生成重置令牌（32 字节随机字符串）
  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 小时后过期

  // 保存重置令牌到数据库
  await prisma.passwordResetToken.create({
    data: {
      token: resetToken,
      userId: user.id,
      expiresAt,
    },
  });

  // 构建重置链接
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

  // 发送邮件
  try {
    if (process.env.SMTP_HOST) {
      await sendEmail({
        to: email,
        subject: "密码重置请求 - Rom's Cinema",
        html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #3b82f6;">密码重置请求</h2>
                        <p>您好，</p>
                        <p>我们收到了您的密码重置请求。请点击下面的链接重置您的密码：</p>
                        <p style="margin: 30px 0;">
                            <a href="${resetUrl}" 
                               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                重置密码
                            </a>
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            此链接将在 1 小时后失效。如果您没有请求重置密码，请忽略此邮件。
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            如果按钮无法点击，请复制以下链接到浏览器：<br>
                            <span style="color: #3b82f6;">${resetUrl}</span>
                        </p>
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 12px;">
                            此邮件由系统自动发送，请勿回复。
                        </p>
                    </div>
                `,
      });
    } else {
      // 开发环境：输出到控制台
      console.info("\n==================================");
      console.info("⚠️ [DEV MODE] SMTP not configured.");
      console.info(`📧 密码重置链接: ${resetUrl}`);
      console.info("==================================\n");
    }

    return NextResponse.json({
      success: true,
      message: "如果该邮箱已注册，您将收到密码重置链接",
    });
  } catch (error: unknown) {
    console.error("[ForgotPassword] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "请求处理失败" },
      { status: 500 },
    );
  }
});
