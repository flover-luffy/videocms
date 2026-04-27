/**
 * JWT 认证工具模块
 * 基于 jose 库实现 RS256 非对称签名的 JWT Token 管理
 */
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from "jose";
import type { JwtPayload } from "@/types";
import { isBlacklisted, isTokenInvalidatedForUser } from "./token-blacklist";

import { JWT_CONFIG } from "@/config";

const privateKeyPromise = importPKCS8(JWT_CONFIG.PRIVATE_KEY, JWT_CONFIG.ALG);
const publicKeyPromise = importSPKI(JWT_CONFIG.PUBLIC_KEY, JWT_CONFIG.ALG);

interface VerifyTokenOptions {
  checkRevocation?: boolean;
}

/** 签发访问 Token */
export async function signAccessToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
): Promise<string> {
  const privateKey = await privateKeyPromise;
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_CONFIG.ALG })
    .setIssuedAt()
    .setExpirationTime(JWT_CONFIG.ACCESS_TOKEN_TTL)
    .sign(privateKey);
}

/** 签发刷新 Token */
export async function signRefreshToken(
  payload: Omit<JwtPayload, "iat" | "exp" | "jti">,
): Promise<string> {
  const jti = crypto.randomUUID();
  const privateKey = await privateKeyPromise;
  return new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: JWT_CONFIG.ALG })
    .setIssuedAt()
    .setExpirationTime(JWT_CONFIG.REFRESH_TOKEN_TTL)
    .sign(privateKey);
}

/**
 * 验证并解析 Token，失败返回 null
 * 包含黑名单检查和用户级别的 token 失效检查
 */
export async function verifyToken(
  token: string,
  options: VerifyTokenOptions = {},
): Promise<JwtPayload | null> {
  try {
    // 1. 验证 token 签名和过期时间
    const publicKey = await publicKeyPromise;
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: [JWT_CONFIG.ALG],
    });
    const jwtPayload = payload as unknown as JwtPayload;

    if (options.checkRevocation !== false) {
      // 2. 检查 token 是否在黑名单中
      if (await isBlacklisted(token)) {
        return null;
      }

      // 3. 检查用户级别的 token 失效（密码重置、强制登出）
      if (jwtPayload.userId && jwtPayload.iat) {
        const isInvalidated = await isTokenInvalidatedForUser(
          jwtPayload.userId,
          jwtPayload.iat,
        );
        if (isInvalidated) {
          return null;
        }
      }
    }

    return jwtPayload;
  } catch {
    return null;
  }
}
