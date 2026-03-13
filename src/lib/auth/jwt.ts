/**
 * JWT 认证工具模块
 * 基于 jose 库实现 HS256 签名的 JWT Token 管理
 */
import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload } from "@/types";

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
export async function signRefreshToken(payload: Omit<JwtPayload, "iat" | "exp" | "jti">): Promise<string> {
    const jti = crypto.randomUUID();
    return new SignJWT({ ...payload, jti })
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
