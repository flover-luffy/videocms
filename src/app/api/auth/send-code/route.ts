import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import nodemailer from 'nodemailer';
import { isDisposableEmail } from '@/lib/email-blocklist';
import { LRUCache } from 'lru-cache';
import { validateCaptcha } from '@/lib/captcha';

// ========== 配置发信冷却（防止被恶意扫号机刷信） ==========
// 使用 内存 LRU Cache 记录每个 IP 最近的发信时间戳
const rateLimitCache = new LRUCache<string, number>({
    max: 1000,
    ttl: 1000 * 60, // 60秒冷却
});

/**
 * 伪随机生成 6 位验证码
 */
function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 获取客户端 IP 的简单方式
 */
function getClientIp(req: Request): string {
    return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
}

export async function POST(request: NextRequest) {
    try {
        const ip = getClientIp(request);

        // 1. 防刷检测: 60 秒只能发一次
        const lastSentAt = rateLimitCache.get(ip);
        if (lastSentAt && Date.now() - lastSentAt < 60000) {
            return NextResponse.json({ error: '请求过于频繁，请等待 60 秒后再试' }, { status: 429 });
        }

        const body = await request.json();
        const { email, captcha } = body;

        // 1.5 图形验证码校验 (NEW)
        const captchaId = request.cookies.get('captcha_id')?.value;
        console.log(`[VERIFY] Captcha check. ID from cookie: ${captchaId}, Input: ${captcha}`);

        if (!captchaId || !captcha || !validateCaptcha(captchaId, captcha)) {
            console.log(`[VERIFY] Captcha failed. Valid ID: ${!!captchaId}, Valid Input: ${!!captcha}`);
            return NextResponse.json({ error: '图形验证码错误或已过期，请刷新重试' }, { status: 400 });
        }

        // 2. 基础邮箱格式与存在性检测
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            return NextResponse.json({ error: '无效的邮箱格式' }, { status: 400 });
        }

        // 3. 拦截临时邮箱 (Disposable Email)
        if (isDisposableEmail(email)) {
            return NextResponse.json({ error: '系统拒收来自临时/一次性邮箱的注册，请使用真实邮箱' }, { status: 403 });
        }

        // 4. 检查是否已被注册
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 });
        }

        // 6. 生成验证码
        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

        // 清理同一邮箱的旧 Code，然后再 create
        await prisma.verificationToken.deleteMany({
            where: { email }
        });
        await prisma.verificationToken.create({
            data: {
                email,
                token: otpCode,
                expiresAt
            }
        });

        // 打上流控时间戳标志
        rateLimitCache.set(ip, Date.now());

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
                subject: '【Rom\'s Cinema】账号注册验证码',
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
            console.log("\n==================================");
            console.log("⚠️ [DEV MODE] SMTP not configured.");
            console.log(`✉️ 模拟向 ${email} 发送注册验证码: [ ${otpCode} ]`);
            console.log("==================================\n");
        }

        return NextResponse.json({ message: '验证码发送成功' }, { status: 200 });

    } catch (error: any) {
        console.error('发送验证码出错:', error);
        return NextResponse.json({ error: '验证码发送失败: ' + error.message }, { status: 500 });
    }
}
