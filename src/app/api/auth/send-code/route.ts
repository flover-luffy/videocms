import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import nodemailer from "nodemailer";
import { randomInt } from "node:crypto";
import { isDisposableEmail } from "@/lib/email-blocklist";
import { sendCodeCache } from "@/lib/cache";
import { validateCaptcha } from "@/lib/captcha";
import { getClientIp } from "@/lib/server-utils";

/**
 * 伪随机生成 6 位验证码
 */
function generateOTP(): string {
  return String(randomInt(100000, 1000000));
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // 1. 防刷检测: IP 维度 60 秒只能发一次
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

    const body = await request.json();
    const { email, captcha } = body;

    // 1.5 图形验证码校验 (NEW)
    const captchaId = request.cookies.get("captcha_id")?.value;
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[VERIFY] Captcha check. ID from cookie: ${captchaId}, Input: ${captcha}`,
      );
    }

    if (!captchaId || !captcha || !validateCaptcha(captchaId, captcha)) {
      console.info(
        `[VERIFY] Captcha failed. Valid ID: ${!!captchaId}, Valid Input: ${!!captcha}`,
      );
      return NextResponse.json(
        { error: "图形验证码错误或已过期，请刷新重试" },
        { status: 400 },
      );
    }

    // 2. 基础邮箱格式与存在性检测
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: "无效的邮箱格式" }, { status: 400 });
    }

    // 3. 拦截临时邮箱 (Disposable Email)
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "系统拒收来自临时/一次性邮箱的注册，请使用真实邮箱" },
        { status: 403 },
      );
    }

    // ✅ 新增：邮箱维度的频率限制（5分钟冷却）
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

    // 4. 检查是否已被注册
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: "如果该邮箱可用，我们将发送验证码",
      });
    }

    // 6. 生成验证码
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 清理同一邮箱的旧 Code，然后再 create
    await prisma.verificationToken.deleteMany({
      where: { email },
    });
    await prisma.verificationToken.create({
      data: {
        email,
        token: otpCode,
        expiresAt,
      },
    });

    // ✅ 同时记录 IP 和邮箱的时间戳
    const now = Date.now();
    await sendCodeCache.set(ipCacheKey, { ts: now }, 60);
    await sendCodeCache.set(emailCacheKey, { ts: now }, 5 * 60);

    // 7. 发送邮件
    //    如果你在 .env 配置了这些环境变量，才会真发。否则会在终端“假发”
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 465,
        secure: Number(SMTP_PORT) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"Rom's Cinema" <${SMTP_USER}>`,
        to: email,
        subject: "【Rom's Cinema】账号注册验证码",
        html: `
                  <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #3b82f6;">Rom's Cinema 账号验证</h2>
                    <p>你好，</p>
                    <p>感谢您注册。您的邮箱验证码是：</p>
                    <h1 style="background: #f3f4f6; padding: 10px 20px; display: inline-block; border-radius: 8px; letter-spacing: 5px;">${otpCode}</h1>
                    <p style="color: #666; font-size: 14px;">此验证码在 10 分钟内有效。请勿泄露给他人。</p>
                    <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
                    <p style="color: #999; font-size: 12px;">如果这不是您的操作，请忽略此邮件。</p>
                  </div>
                `,
      });
    } else {
      console.info("\n==================================");
      console.info("⚠️ [DEV MODE] SMTP not configured.");
      console.info(`✉️ 模拟向 ${email} 发送注册验证码: [ ${otpCode} ]`);
      console.info("==================================\n");
    }

    return NextResponse.json({ message: "验证码发送成功" }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("发送验证码出错:", message);
    return NextResponse.json(
      { error: "验证码发送失败: " + message },
      { status: 500 },
    );
  }
}
