import { headers } from "next/headers";

/**
 * 工业级移动端探测工具 (Server-Side Device Detection)
 * 判断当前请求是否来自移动端设备
 *
 * 优势:
 * 1. 消除 SSR Hydration Mismatch (FOIC)
 * 2. 移除客户端包装组件从而减小 Bundle 体积
 * 3. 提升首屏渲染速度
 */
export async function getServerIsMobile(): Promise<boolean> {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";

  // 正则匹配常见移动端设备标志
  return /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    userAgent.toLowerCase(),
  );
}
