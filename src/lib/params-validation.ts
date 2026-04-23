import { z } from "zod";

/**
 * 安全地验证和解析数字 ID 参数
 */
export function parseIntId(value: string | undefined): number {
  if (!value) {
    throw new Error("缺少 ID 参数");
  }

  try {
    const parsed = z.number().int().positive().parse(parseInt(value, 10));
    return parsed;
  } catch {
    throw new Error(`无效的 ID 格式: ${value}`);
  }
}

/**
 * 安全地验证和解析字符串 ID 参数（UUID 或 slug）
 */
export function parseStringId(value: string | undefined, pattern?: RegExp): string {
  if (!value) {
    throw new Error("缺少 ID 参数");
  }

  const trimmedValue = value.trim();

  if (pattern && !pattern.test(trimmedValue)) {
    throw new Error(`ID 不符合预期格式: ${trimmedValue}`);
  }

  return trimmedValue;
}

/**
 * 验证分页参数
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export function parsePaginationParams(
  pageStr?: string,
  limitStr?: string,
  maxLimit: number = 100
): PaginationParams {
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(limitStr ?? "20", 10)));

  if (isNaN(page) || isNaN(limit)) {
    throw new Error("无效的分页参数");
  }

  return { page, limit };
}

/**
 * 验证枚举值
 */
export function parseEnum<T extends string>(
  value: string | undefined,
  validValues: readonly T[],
  defaultValue?: T
): T {
  if (!value) {
    if (defaultValue) return defaultValue;
    throw new Error("缺少必需的参数");
  }

  if (!validValues.includes(value as T)) {
    throw new Error(`无效的值: ${value}。允许值: ${validValues.join(", ")}`);
  }

  return value as T;
}

/**
 * 验证布尔值参数
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * 验证日期参数
 */
export function parseDate(value: string | undefined): Date {
  if (!value) {
    throw new Error("缺少日期参数");
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`无效的日期格式: ${value}`);
  }

  return date;
}

/**
 * 生成安全的 SQL LIKE 搜索模式
 */
export function escapeLikePattern(input: string): string {
  return input
    .replace(/[\\%_]/g, "\\$&") // 转义特殊字符
    .trim()
    .substring(0, 100); // 限制长度防止正则拒绝服务
}
