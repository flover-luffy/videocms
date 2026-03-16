/**
 * 通用工具库 (客户端/服务端兼容)
 */

/**
 * 规范化 Json 数组输出
 * 适配 Postgres 驱动可能返回 JSON 字符串或数组的情况
 */
export function normalizeJsonArray(input: unknown): string[] {
    if (!input) return [];
    if (Array.isArray(input)) return input as string[];

    if (typeof input === "string") {
        try {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed : [input];
        } catch {
            // 如果解析失败，可能是普通逗号分隔字符串
            return input.split(",").map(s => s.trim()).filter(Boolean);
        }
    }

    return [];
}

/**
 * 安全解析 JSON (支持对象、字符串、Null)
 */
export function safeJsonParse<T>(input: unknown, defaultValue: T): T {
    if (input === null || input === undefined) return defaultValue;
    if (typeof input === "object" && !Array.isArray(input)) return input as T;
    if (typeof input === "string" && input.trim() !== "") {
        try {
            return JSON.parse(input);
        } catch {
            return defaultValue;
        }
    }
    return defaultValue;
}

/**
 * 获取客户端 Cookie (仅在浏览器环境有效)
 */
export function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
}
