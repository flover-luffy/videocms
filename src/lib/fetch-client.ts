/**
 * 客户端统一 Fetch 封装
 * 自动注入 CSRF Token，消除各组件中重复的 header 模板
 */
import { getCookie } from "./utils";

/**
 * 构建带 CSRF Token 的请求头
 * 写操作（POST/PUT/DELETE/PATCH）额外附加 Content-Type
 */
function buildHeaders(
    method: string,
    extraHeaders?: HeadersInit,
): HeadersInit {
    const csrfToken = getCookie("XSRF-TOKEN") || "";
    const base: Record<string, string> = {
        "x-xsrf-token": csrfToken,
    };

    // 写操作默认附加 JSON Content-Type
    const isWrite = ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase());
    if (isWrite) {
        base["Content-Type"] = "application/json";
    }

    // 合并调用方自定义 headers（允许覆盖默认值）
    if (extraHeaders) {
        const entries = extraHeaders instanceof Headers
            ? Array.from(extraHeaders.entries())
            : Array.isArray(extraHeaders)
                ? extraHeaders
                : Object.entries(extraHeaders);
        for (const [key, value] of entries) {
            base[key] = value;
        }
    }

    return base;
}

/**
 * 带 CSRF 保护的 fetch 封装
 * 用法与原生 fetch 完全一致，自动注入 x-xsrf-token header
 */
export async function fetchWithCsrf(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    const method = options.method || "GET";
    const headers = buildHeaders(method, options.headers as HeadersInit | undefined);

    return fetch(url, {
        ...options,
        headers,
    });
}
