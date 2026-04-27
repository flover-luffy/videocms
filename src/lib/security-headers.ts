import { NextResponse } from "next/server";

/**
 * 安全头配置（基础部分，COEP 按路径动态设置）
 */
const STATIC_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/**
 * 添加安全头到响应 (动态构建 CSP 以支持 Nonce)
 * @param response - NextResponse 实例
 * @param nonce - CSP nonce 值
 * @param pathname - 请求路径，用于判断是否需要启用 Cross-Origin-Isolated
 */
export function addSecurityHeaders(
  response: NextResponse,
  nonce?: string,
  pathname?: string,
): NextResponse {
  const isDevelopment = process.env.NODE_ENV !== "production";

  // 静态头部
  for (const [key, value] of Object.entries(STATIC_HEADERS)) {
    response.headers.set(key, value);
  }

  // 播放页需要 Cross-Origin-Isolated 以启用 SharedArrayBuffer。
  // COEP credentialless（Chrome 96+）比 require-corp 更宽松，
  // 不要求第三方资源（如 AList 视频流）携带 CORP 头。
  const isPlayPage = pathname?.startsWith("/play/") || pathname === "/play";
  response.headers.set(
    "Cross-Origin-Embedder-Policy",
    isPlayPage ? "credentialless" : "unsafe-none",
  );

  // 动态构建 CSP (生产环境使用 nonce 收紧脚本与样式标签)
  const scriptSrc = isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://app.glitchtip.com;"
    : `script-src 'self' ${nonce ? `'nonce-${nonce}' 'strict-dynamic'` : "'unsafe-inline'"} blob: https://app.glitchtip.com;`;

  // ⚠️ style-src 必须保留 'unsafe-inline'。
  // Artplayer (setStyleText → createElement("style"))、Framer Motion 等第三方库
  // 在运行时通过 JS 动态创建 <style> 标签，无法携带 nonce，
  // 若移除 'unsafe-inline' 会导致字幕渲染、动画等全部失效。
  const styleSrc =
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;";

  const connectSrc = isDevelopment
    ? "connect-src 'self' http: https: ws: wss: https://app.glitchtip.com;"
    : "connect-src 'self' https: wss: https://app.glitchtip.com;";

  const csp = `
        default-src 'self';
        ${scriptSrc}
        ${styleSrc}
        img-src 'self' https: data:;
        font-src 'self' data: https://fonts.gstatic.com;
        ${connectSrc}
        worker-src 'self' blob: data:;
        media-src 'self' https: blob:;
        frame-ancestors 'none';
        base-uri 'self';
        form-action 'self';
    `
    .replace(/\s{2,}/g, " ")
    .trim();

  response.headers.set("Content-Security-Policy", csp);

  // 添加 HSTS（仅在生产环境）
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  return response;
}
