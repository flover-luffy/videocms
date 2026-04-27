import { NextResponse, NextRequest } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { isDisposableEmail } from "@/lib/email-blocklist";
import { sendCodeCache } from "@/lib/cache";
import { validateCaptcha } from "@/lib/captcha";
import { getClientIp } from "@/lib/server-utils";
import { sendEmail } from "@/lib/email";
import { withApiHandler } from "@/lib/api-handler";

const GENERIC_SUCCESS = {
  success: true,
  message: "如果该邮箱可用，我们将发送验证码",
};

function generateOTP(): string {
  return String(randomInt(100000, 1000000));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function markSendAttempt(ipKey: string, emailKey: string): Promise<void> {
  const now = Date.now();
  await Promise.all([
    sendCodeCache.set(ipKey, { ts: now }, 60),
    sendCodeCache.set(emailKey, { ts: now }, 5 * 60),
  ]);
}

export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const ip = getClientIp(request);
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const captcha = typeof body?.captcha === "string" ? body.captcha : "";

    const ipCacheKey = `send-code:ip:${ip}`;
    const ipCached = await sendCodeCache.get(ipCacheKey);
    if (ipCached && Date.now() - ipCached.ts < 60000) {
      const waitSeconds = Math.ceil(
        (60000 - (Date.now() - ipCached.ts)) / 1000,
      );
      return NextResponse.json(
        { error: `请求过于频繁，请等待 ${waitSeconds} 秒后再试` },
        { status: 429 },
      );
    }

    const captchaId = request.cookies.get("captcha_id")?.value;
    if (!captchaId || !captcha || !validateCaptcha(captchaId, captcha)) {
      return NextResponse.json(
        { error: "图形验证码错误或已过期，请刷新重试" },
        { status: 400 },
      );
    }

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: "无效的邮箱格式" }, { status: 400 });
    }

    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "系统拒收临时邮箱注册，请使用真实邮箱" },
        { status: 403 },
      );
    }

    const emailNormalized = email.toLowerCase();
    const emailCacheKey = `send-code:email:${emailNormalized}`;
    const emailCached = await sendCodeCache.get(emailCacheKey);
    if (emailCached && Date.now() - emailCached.ts < 5 * 60 * 1000) {
      const waitSeconds = Math.ceil(
        (5 * 60 * 1000 - (Date.now() - emailCached.ts)) / 1000,
      );
      const waitMinutes = Math.ceil(waitSeconds / 60);
      return NextResponse.json(
        { error: `该邮箱请求过于频繁，请 ${waitMinutes} 分钟后再试` },
        { status: 429 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      await Promise.all([
        markSendAttempt(ipCacheKey, emailCacheKey),
        sleep(250 + randomInt(150)),
      ]);
      return NextResponse.json(GENERIC_SUCCESS);
    }

    const otpCode = generateOTP();
    const tokenHash = hashToken(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.$transaction([
      prisma.verificationToken.deleteMany({ where: { email } }),
      prisma.verificationToken.create({
        data: {
          email,
          token: tokenHash,
          expiresAt,
        },
      }),
    ]);

    await markSendAttempt(ipCacheKey, emailCacheKey);

    if (!process.env.SMTP_HOST && process.env.NODE_ENV === "development") {
      console.info(`[DEV MODE] Registration code for ${email}: ${otpCode}`);
    }

    await sendEmail({
      to: email,
      subject: "【Rom's Cinema】账号注册验证码",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #3b82f6;">Rom's Cinema 账号验证</h2>
          <p>您好：</p>
          <p>感谢您注册。您的邮箱验证码是：</p>
          <h1 style="background: #f3f4f6; padding: 10px 20px; display: inline-block; border-radius: 8px; letter-spacing: 5px;">${otpCode}</h1>
          <p style="color: #666; font-size: 14px;">此验证码将在 10 分钟后失效，请勿泄露给他人。</p>
        </div>
      `,
      text: `Rom's Cinema 注册验证码：${otpCode}`,
    });

    return NextResponse.json(GENERIC_SUCCESS);
  } catch (error: unknown) {
    console.error("[SendCode] Failed:", error);
    return NextResponse.json(
      { error: "验证码发送失败，请稍后重试" },
      { status: 500 },
    );
  }
});
