import { NextResponse } from "next/server";

/**
 * 安全头配置
 */
export const SECURITY_HEADERS = {
    // 内容安全策略
    "Content-Security-Policy": 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' https: data:; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "connect-src 'self' https:; " +
        "media-src 'self' https: blob:; " +  // 添加 media-src 允许外部视频
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'",
    
    // 防止点击劫持
    "X-Frame-Options": "DENY",
    
    // 防止 MIME 类型嗅探
    "X-Content-Type-Options": "nosniff",
    
    // XSS 保护
    "X-XSS-Protection": "1; mode=block",
    
    // 引用策略
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // 权限策略
    "Permissions-Policy": 
        "geolocation=(), " +
        "microphone=(), " +
        "camera=(), " +
        "payment=(), " +
        "usb=(), " +
        "magnetometer=(), " +
        "gyroscope=(), " +
        "accelerometer=()",
};

/**
 * 添加安全头到响应
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    
    // 添加 HSTS（仅在生产环境）
    if (process.env.NODE_ENV === "production") {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload"
        );
    }
    
    return response;
}
