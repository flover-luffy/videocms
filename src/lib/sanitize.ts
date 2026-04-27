/**
 * 路径清理工具 - 深度防护
 * 防止路径遍历、规范化旁路、Unicode 编码攻击等
 */

/**
 * 路径验证和清理的核心类
 */
export class PathValidator {
  // 允许的最大路径长度
  private static readonly MAX_PATH_LENGTH = 1000;

  // 允许的安全字符集（支持中文及其他语言的 Unicode，排除特殊的 shell/控制字符）
  // 配合下方的 blacklist 机制提供纵深防御
  private static readonly SAFE_CHAR_PATTERN = /^[^\x00-\x1F\x7F*?|<>"$\\]+$/;

  /**
   * 清理和验证路径（防止路径遍历）
   * @param path 原始路径
   * @param basePath 基路径（可选的白名单检查）
   * @returns 清理后的路径
   * @throws 如果路径包含危险字符或试图逃逸基路径
   */
  static sanitizePath(path: string, basePath?: string): string {
    if (!path || typeof path !== "string") {
      throw new Error("Invalid path: must be a non-empty string");
    }

    // ✅ 1. 长度检查
    if (path.length > this.MAX_PATH_LENGTH) {
      throw new Error(`Path exceeds maximum length of ${this.MAX_PATH_LENGTH}`);
    }

    // ✅ 2. 递归解码直到不再变化（防止 %25 = % 的双重编码攻击）
    let decoded = path;
    let previousDecoded = "";
    let iterations = 0;
    const maxIterations = 5;

    while (decoded !== previousDecoded && iterations < maxIterations) {
      previousDecoded = decoded;
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        // 解码失败，使用当前值
        break;
      }
      iterations++;
    }

    // ✅ 3. Unicode 规范化（防止规范化旁路）
    decoded = decoded.normalize("NFC");

    // ✅ 4. 规范化路径分隔符
    const normalized = decoded
      .replace(/\\/g, "/") // 反斜杠转正斜杠（Windows）
      .replace(/\/+/g, "/") // 多个连续斜杠合并为单个
      .replace(/^\/+/, "/") // 开头多个斜杠规范化为单个
      .replace(/\/$/, ""); // 移除末尾斜杠

    // ✅ 5. 分解路径为组件，逐级验证
    const parts = normalized.split("/").filter((p) => p.length > 0);

    const safeParts: string[] = [];

    for (const part of parts) {
      // ❌ 拒绝当前目录或父目录引用
      if (part === "." || part === "..") {
        throw new Error(`Path traversal detected: "${part}" in path`);
      }

      if (part === "") {
        continue;
      }

      // ❌ 拒绝包含空字符（null byte injection）
      if (part.includes("\x00")) {
        throw new Error("Null byte detected in path");
      }

      // ❌ 拒绝包含特殊 shell 字符
      const forbiddenChars = ["*", "?", "|", "<", ">", '"'];
      if (forbiddenChars.some((char) => part.includes(char))) {
        throw new Error(`Forbidden character in path: ${part}`);
      }

      // ❌ 拒绝 Windows ADS (Alternate Data Streams) 攻击
      if (part.includes(":") || part.startsWith("$")) {
        throw new Error("Windows ADS attack detected");
      }

      // ❌ 白名单强制检查：拒绝包含不安全字符的路径段
      if (!this.SAFE_CHAR_PATTERN.test(part)) {
        throw new Error(`Unsafe characters in path component: ${part}`);
      }

      safeParts.push(part);
    }

    // ✅ 6. 重组路径
    const result = "/" + safeParts.join("/");

    // ✅ 7. 基路径检查（可选的白名单验证）
    if (basePath) {
      const baseNormalized = basePath.endsWith("/") ? basePath : basePath + "/";
      if (!result.startsWith(baseNormalized)) {
        throw new Error(`Path escapes base directory: ${result}`);
      }
    }

    // ✅ 8. 最终验证：规范化前后路径要合理相关
    const expectedPatterns = [/^[a-zA-Z0-9\-_./]+$/, /^\/[a-zA-Z0-9\-_.\/]*$/];

    const isValidPattern = expectedPatterns.some((pattern) =>
      pattern.test(normalized),
    );

    if (!isValidPattern && normalized.includes("%")) {
      console.warn(`[PathValidator] 路径包含编码字符，但无效: ${normalized}`);
    }

    return result;
  }

  /**
   * 检查路径是否安全（不修改，仅验证）
   */
  static isPathSafe(path: string): boolean {
    try {
      this.sanitizePath(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 解析路径为目录和文件名
   */
  static parsePath(path: string): { dir: string; file: string } {
    const sanitized = this.sanitizePath(path);
    const lastSlash = sanitized.lastIndexOf("/");

    if (lastSlash === -1 || lastSlash === 0) {
      return {
        dir: "/",
        file: sanitized.replace(/^\//, ""),
      };
    }

    return {
      dir: sanitized.slice(0, lastSlash),
      file: sanitized.slice(lastSlash + 1),
    };
  }
}

// ✅ 导出供全局使用
/**
 * 清理 URL 路径
 */
export function sanitizePath(path: string): string {
  return PathValidator.sanitizePath(path);
}

/**
 * 检查路径是否安全
 */
export function isPathSafe(path: string): boolean {
  return PathValidator.isPathSafe(path);
}
