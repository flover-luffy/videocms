import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createRateLimiter, RATE_LIMITS } from "@/lib/rate-limit";

const rateLimiter = createRateLimiter(RATE_LIMITS.auth);
const MIN_RESPONSE_TIME_MS = 700;
const GENERIC_RESPONSE = {
  success: true,
  message: "If the email is registered, a reset link will be sent shortly.",
};

const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureMinimumResponseDuration(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_TIME_MS) {
    await sleep(MIN_RESPONSE_TIME_MS - elapsed);
  }
}

export const POST = withApiHandler(async (request: NextRequest) => {
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json().catch(() => null);
  const result = ForgotPasswordSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  const { email } = result.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user) {
      const { randomBytes } = await import("crypto");
      const resetToken = randomBytes(32).toString("hex");
      const tokenHash = hashToken(resetToken);
      // SECURITY: 密码重置token 15分钟过期，减少攻击窗口
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, used: false },
          data: { used: true },
        }),
        prisma.passwordResetToken.create({
          data: {
            token: tokenHash,
            userId: user.id,
            expiresAt,
          },
        }),
      ]);

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

      if (process.env.SMTP_HOST) {
        await sendEmail({
          to: email,
          subject: "Password Reset Request - Rom's Cinema",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Password Reset Request</h2>
              <p>We received a request to reset your password.</p>
              <p style="margin: 24px 0;">
                <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Reset Password
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes.</p>
            </div>
          `,
        });
      } else {
        console.info("[ForgotPassword] SMTP not configured, reset link generated in dev mode", {
          email,
          resetUrl,
        });
      }
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error: unknown) {
    console.error("[ForgotPassword] Failed:", error);
    return NextResponse.json(
      { error: "Request processing failed, please try again later" },
      { status: 500 },
    );
  } finally {
    await ensureMinimumResponseDuration(startedAt);
  }
});
