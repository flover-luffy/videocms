import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import bcrypt from "bcryptjs";
import { withApiHandler } from "@/lib/api-handler";
import { RegisterSchema } from "@/lib/validation";
import { setAuthCookies } from "@/lib/auth/cookies";

/**
 * 用户注册 API
 * POST /api/auth/register
 */
export const POST = withApiHandler(async (request: NextRequest) => {
    const json = await request.json().catch(() => null);
    const result = RegisterSchema.safeParse(json);

    if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }
    const { email, password } = result.data;

    // 1. 检查是否存在
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return NextResponse.json({ error: "该邮箱已被注册" }, { status: 409 });
    }

    // 2. 创建用户
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
        data: {
            email,
            passwordHash: hash,
            role: "user", // 安全固定：注册只能创建普通用户，管理员需通过后台提权
        },
    });

    // 3. 签发 Token
    const tokenPayload = { userId: newUser.id, email: newUser.email, role: newUser.role };
    const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(tokenPayload),
        signRefreshToken(tokenPayload),
    ]);

    const res = NextResponse.json({
        accessToken,
        user: { id: newUser.id, email: newUser.email, role: newUser.role },
    });

    // 4. 统一写入双 Token HttpOnly Cookie（与 login 行为一致）
    setAuthCookies(res, { accessToken, refreshToken });

    return res;
});
