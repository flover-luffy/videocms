import { NextResponse } from "next/server";
import { generateCaptcha, setCaptcha } from "@/lib/captcha";
import { randomUUID } from "node:crypto";
import { createRateLimiter, RATE_LIMITS } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

const rateLimiter = createRateLimiter(RATE_LIMITS.auth);

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const { text, data } = generateCaptcha();
  const captchaId = randomUUID();

  // 存入缓存
  setCaptcha(captchaId, text);

  if (process.env.NODE_ENV === "development") {
    console.info(
      `[CAPTCHA] Generating new captcha. ID: ${captchaId}, Text: ${text}`,
    );
  }

  const response = NextResponse.json({
    svg: data,
  });

  // 显式禁止缓存
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  // 将 captchaId 存入 cookie，有效期 5 分钟
  response.cookies.set("captcha_id", captchaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  return response;
}
