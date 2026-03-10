/**
 * JWT 认证工具模块
 * 基于 jose 库实现 HS256 签名的 JWT Token 管理
 */
import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload } from "@/types";

if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
        throw new Error("🚨 [FATAL] 生产环境中必须设置 JWT_SECRET!");
    }
    console.warn("⚠️ [SECURITY] 未配置 JWT_SECRET，使用弱密钥模式");
}

import { JWT_CONFIG } from "@/config";

const SECRET = new TextEncoder().encode(JWT_CONFIG.SECRET);

/** 签发访问 Token */
export async function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(JWT_CONFIG.ACCESS_TOKEN_TTL)
        .sign(SECRET);
}

/** 签发刷新 Token */
export async function signRefreshToken(payload: Omit<JwtPayload, "iat" | "exp">): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(JWT_CONFIG.REFRESH_TOKEN_TTL)
        .sign(SECRET);
}

/** 验证并解析 Token，失败返回 null */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload as unknown as JwtPayload;
    } catch {
        return null;
    }
}
