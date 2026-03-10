import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF 保护助手 (Double Submit Cookie 模式)
 * 适配 Next.js Edge Runtime，不依赖 Node.js 原生模块
 */
export class CsrfProtection {
    private static readonly COOKIE_NAME = "XSRF-TOKEN";
    private static readonly HEADER_NAME = "x-xsrf-token";

    /**
     * 生成安全随机字符串 (Hex 格式)
     * 适配 Edge Runtime (Web Crypto API)
     */
    private static generateRandomToken(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * 生成并设置 CSRF Cookie
     */
    static setCsrfCookie(response: NextResponse): string {
        const token = this.generateRandomToken();
        response.cookies.set(this.COOKIE_NAME, token, {
            path: "/",
            httpOnly: false, // 允许前端 JS 读取进行对比
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });
        return token;
    }

    /**
     * CSRF 保护中间件逻辑
     */
    static middleware(request: NextRequest): NextResponse | null {
        // 1. 仅对状态改变的请求进行检查
        if (!["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
            return null;
        }

        // 2. 检查来源（Origin/Referer 强制验证）
        const origin = request.headers.get("origin");
        const host = request.headers.get("host");

        if (origin) {
            try {
                const originUrl = new URL(origin);
                if (originUrl.host !== host) {
                    return NextResponse.json({ error: "CSRF: Origin mismatch" }, { status: 403 });
                }
            } catch {
                return NextResponse.json({ error: "CSRF: Invalid origin" }, { status: 403 });
            }
        }

        // 3. Double Submit Cookie 验证
        const cookieToken = request.cookies.get(this.COOKIE_NAME)?.value;
        const headerToken = request.headers.get(this.HEADER_NAME) || request.headers.get("x-csrf-token");

        if (!cookieToken || !headerToken) {
            return NextResponse.json(
                { error: "CSRF token missing" },
                { status: 403 }
            );
        }

        if (cookieToken !== headerToken) {
            return NextResponse.json(
                { error: "CSRF token mismatch" },
                { status: 403 }
            );
        }

        return null; // 验证通过
    }
}
