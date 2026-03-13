import { NextResponse } from "next/server";

/**
 * 安全头配置
 */
const STATIC_HEADERS = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
        "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
};

/**
 * 添加安全头到响应 (动态构建 CSP 以支持 Nonce)
 */
export function addSecurityHeaders(response: NextResponse, nonce?: string): NextResponse {
    // 静态头部
    Object.entries(STATIC_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    // 动态构建 CSP (消除 script-src 的 unsafe-inline 隐患)
    // 注意：style-src 针对部分内联样式或组件库依然保留 unsafe-inline 以防过度阻断
    const csp = `
        default-src 'self';
        script-src 'self' ${nonce ? `'nonce-${nonce}' 'strict-dynamic'` : "'unsafe-inline'"} https://app.glitchtip.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' https: data:;
        font-src 'self' data: https://fonts.gstatic.com;
        connect-src 'self' https: wss: https://app.glitchtip.com;
        worker-src 'self' blob: data:;
        media-src 'self' https: blob:;
        frame-ancestors 'none';
        base-uri 'self';
        form-action 'self'
    `.replace(/\s{2,}/g, ' ').trim();

    response.headers.set("Content-Security-Policy", csp);

    // 添加 HSTS（仅在生产环境）
    if (process.env.NODE_ENV === "production") {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload"
        );
    }

    return response;
}
