/**
 * 认证 Cookie 工具函数
 * 统一 login 和 register 接口设置双 Cookie 的行为
 */
import type { NextResponse } from "next/server";

interface SetAuthCookiesOptions {
    accessToken: string;
    refreshToken: string;
    /** 是否为 HTTPS 环境（默认通过 NODE_ENV 判断） */
    secure?: boolean;
}

import { JWT_CONFIG } from "@/config";

/**
 * 统一将 access_token 和 refresh_token 写入 HttpOnly Cookie
 * @param res   NextResponse 实例
 * @param opts  Token 选项
 */
export function setAuthCookies(
    res: NextResponse,
    opts: SetAuthCookiesOptions,
): void {
    const isSecure = opts.secure ?? process.env.NODE_ENV === "production";

    const baseOptions = {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax" as const,
        path: "/",
    };

    res.cookies.set("access_token", opts.accessToken, {
        ...baseOptions,
        maxAge: JWT_CONFIG.ACCESS_TOKEN_MAX_AGE,
    });

    res.cookies.set("refresh_token", opts.refreshToken, {
        ...baseOptions,
        maxAge: JWT_CONFIG.REFRESH_TOKEN_MAX_AGE,
    });
}
