import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF 保护助手 (Double Submit Cookie + Origin/Referer 验证)
 * 同时检查来源（Origin/Referer）和双交换 Token
 */
export class CsrfProtection {
  private static readonly COOKIE_NAME = "__csrf_token";
  private static readonly HEADER_NAME = "x-csrf-token";
  private static readonly TOKEN_LENGTH = 32;

  /**
   * 生成安全随机 Token (Hex 格式)
   * 使用 Web Crypto，兼容 Node.js 与 Edge Runtime
   */
  private static generateRandomToken(): string {
    const bytes = new Uint8Array(this.TOKEN_LENGTH);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
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
   * 改进的 CSRF 验证中间件
   * 同时检查 Origin、Referer 和 Token
   */
  static middleware(request: NextRequest): NextResponse | null {
    // 1. 仅对状态改变的请求进行检查
    if (!["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
      return null;
    }

    const host = request.headers.get("host") || "";
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    // 2. Step 1: 验证 Origin 和 Referer
    let isOriginValid = false;

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host === host) {
          isOriginValid = true;
        }
      } catch {
        // Origin 格式错误，拒绝
        return NextResponse.json(
          { error: "CSRF: Invalid origin format" },
          { status: 403, headers: { "X-CSRF-Error": "invalid_origin" } },
        );
      }
    }

    // 如果 Origin 检查失败，尝试 Referer（备选防御）
    if (!isOriginValid && referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host === host) {
          isOriginValid = true;
        }
      } catch {
        // Referer 格式错误
        return NextResponse.json(
          { error: "CSRF: Invalid referer format" },
          { status: 403, headers: { "X-CSRF-Error": "invalid_referer" } },
        );
      }
    }

    // 至少有一个有效的来源（Origin 或 Referer）
    // 如果明确的不匹配，拒绝
    if (!isOriginValid) {
      if (!origin && !referer) {
        // 某些请求可能缺少这些头，继续进行 Token 验证
        console.info("[CSRF] 请求缺少 Origin/Referer，进行 Token 验证");
      } else {
        // 明确的不匹配，直接拒绝
        return NextResponse.json(
          { error: "CSRF: Origin/Referer mismatch" },
          { status: 403, headers: { "X-CSRF-Error": "origin_mismatch" } },
        );
      }
    }

    // 3. Step 2: Token 验证（双层防御）
    const cookieToken = request.cookies.get(this.COOKIE_NAME)?.value;
    const headerToken =
      request.headers.get(this.HEADER_NAME) ||
      request.headers.get("x-csrf-token");

    if (!cookieToken || !headerToken) {
      return NextResponse.json(
        { error: "CSRF: Token missing" },
        { status: 403, headers: { "X-CSRF-Error": "token_missing" } },
      );
    }

    // 验证 Token 匹配（使用安全的位比较，适配 Edge Runtime）
    try {
      if (!this.validateTokenSafe(cookieToken, headerToken)) {
        return NextResponse.json(
          { error: "CSRF: Token mismatch" },
          { status: 403, headers: { "X-CSRF-Error": "token_mismatch" } },
        );
      }
    } catch (err) {
      console.error("[CSRF] Token 验证异常:", err);
      return NextResponse.json(
        { error: "CSRF: Validation error" },
        { status: 403, headers: { "X-CSRF-Error": "validation_error" } },
      );
    }

    return null; // 验证通过
  }

  /**
   * 验证 Token（安全字符串比较）
   * 在 middleware（Edge Runtime）中使用安全的位比较
   * 注：仅在 Edge Runtime 中调用，不使用 Node.js crypto 模块
   */
  private static validateTokenSafe(
    cookieToken: string,
    headerToken: string,
  ): boolean {
    const maxLength = Math.max(cookieToken.length, headerToken.length);
    let result = 0;
    for (let i = 0; i < maxLength; i++) {
      const cookieCode = i < cookieToken.length ? cookieToken.charCodeAt(i) : 0;
      const headerCode = i < headerToken.length ? headerToken.charCodeAt(i) : 0;
      result |= cookieCode ^ headerCode;
    }
    return cookieToken.length === headerToken.length && result === 0;
  }

  /**
   * 验证 Token
   * 保留该接口以兼容现有调用方
   */
  static validateTokenCrypto(
    cookieToken: string,
    headerToken: string,
  ): boolean {
    return this.validateTokenSafe(cookieToken, headerToken);
  }
}
