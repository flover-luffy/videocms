import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { withApiHandler } from "@/lib/api-handler";
import { LoginSchema } from "@/lib/validation";
import { setAuthCookies } from "@/lib/auth/cookies";
import { AuditLogger } from "@/lib/audit-logger";
import { cacheManager } from "@/lib/cache";
import { getClientIp } from "@/lib/server-utils";

const loginAttemptCache = cacheManager.getCache<{
  count: number;
  timestamp: number;
}>("login-attempts", 5000, 900);
const DUMMY_PASSWORD_HASH =
  "$2b$12$GlX.P4kdpxa.cSC0GGCbcegtDmpWPiYWYlFCTBKun/lN/T1WMSWCm";

function getLoginRateLimitKeys(email: string, ip: string): string[] {
  return [`ip:${ip}`, `email:${email.toLowerCase()}`];
}

async function trackLoginAttempt(
  key: string,
  success: boolean,
): Promise<void> {
  const cacheKey = `login:attempts:${key}`;
  const maxAttempts = 5;

  if (success) {
    await loginAttemptCache.delete(cacheKey);
    return;
  }

  const existing = await loginAttemptCache.get(cacheKey);
  const attempts = (existing?.count ?? 0) + 1;

  await loginAttemptCache.set(
    cacheKey,
    { count: attempts, timestamp: Date.now() },
    900,
  );

  if (attempts >= maxAttempts) {
    throw new Error("Too many login attempts");
  }
}

async function isLoginRateLimited(key: string): Promise<boolean> {
  const data = await loginAttemptCache.get(`login:attempts:${key}`);
  return data !== null && data.count >= 5;
}

async function trackLoginAttempts(
  keys: string[],
  success: boolean,
): Promise<void> {
  await Promise.all(keys.map((key) => trackLoginAttempt(key, success)));
}

async function isAnyLoginRateLimited(keys: string[]): Promise<boolean> {
  const results = await Promise.all(keys.map((key) => isLoginRateLimited(key)));
  return results.some(Boolean);
}

export const POST = withApiHandler(async (request: NextRequest) => {
  const ip = getClientIp(request);
  const json = await request.json().catch(() => null);
  const result = LoginSchema.safeParse(json);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  const { email, password } = result.data;
  const rateLimitKeys = getLoginRateLimitKeys(email, ip);

  let isRateLimited = false;
  try {
    isRateLimited = await isAnyLoginRateLimited(rateLimitKeys);
  } catch (err) {
    console.warn("[Login] Unable to check rate limit", err);
  }

  if (isRateLimited) {
    await AuditLogger.logLoginAttempt(email, ip, false, "login_rate_limited");
    return NextResponse.json(
      { error: "尝试次数过多，请 15 分钟后再试" },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user) {
    try {
      await trackLoginAttempts(rateLimitKeys, false);
    } catch (err) {
      console.warn("[Login] Unable to record failed login attempt", err);
    }
    await AuditLogger.logLoginAttempt(email, ip, false, "user_not_found");
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  if (!valid) {
    try {
      await trackLoginAttempts(rateLimitKeys, false);
    } catch (err) {
      console.warn("[Login] Unable to record failed login attempt", err);
    }
    await AuditLogger.logLoginAttempt(email, ip, false, "invalid_password");
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  try {
    await trackLoginAttempts(rateLimitKeys, true);
  } catch (err) {
    console.warn("[Login] Unable to clear login counters", err);
  }
  await AuditLogger.logLoginAttempt(email, ip, true);

  const tokenPayload = { userId: user.id, email: user.email, role: user.role };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ]);

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role },
  });

  setAuthCookies(res, { accessToken, refreshToken });
  return res;
});
