/**
 * JWT 认证工具模块
 * 基于 jose 库实现 HS256 签名的 JWT Token 管理
 */
import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload } from "@/types";
import { isBlacklisted, isTokenInvalidatedForUser } from "./token-blacklist";

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

/** 
 * 验证并解析 Token，失败返回 null
 * 包含黑名单检查和用户级别的 token 失效检查
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
    try {
        // 1. 验证 token 签名和过期时间
        const { payload } = await jwtVerify(token, SECRET);
        const jwtPayload = payload as unknown as JwtPayload;

        // 2. 检查 token 是否在黑名单中
        if (await isBlacklisted(token)) {
            return null;
        }

        // 3. 检查用户级别的 token 失效（密码重置、强制登出）
        if (jwtPayload.userId && jwtPayload.iat) {
            const isInvalidated = await isTokenInvalidatedForUser(
                jwtPayload.userId,
                jwtPayload.iat
            );
            if (isInvalidated) {
                return null;
            }
        }

        return jwtPayload;
    } catch {
        return null;
    }
}
