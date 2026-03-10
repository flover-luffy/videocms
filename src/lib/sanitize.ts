/**
 * 路径清理工具
 * 防止目录遍历等安全问题
 */

/**
 * 清理 URL 路径
 */
export function sanitizePath(path: string): string {
    // 移除 .. 和 // 防止目录遍历
    return path
        .replace(/\.\./g, "")
        .replace(/\/+/g, "/")
        .replace(/^\/+/, "/")
        .slice(0, 500);
}
