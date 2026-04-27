import { config } from "dotenv";
import path from "path";

// 强制加载环境配置：解决某些运行时环境下 process.env 不及时的 Bug
config({ path: path.resolve(process.cwd(), ".env") });

/**
 * 应用配置中心
 * 统一管理所有配置项，避免硬编码
 */

// 核心环境变量列表
const REQUIRED_ENVS = [
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
  "ENCRYPTION_SECRET",
  "ENCRYPTION_SALT",
  "DATABASE_URL",
] as const;

function requireEnv(key: (typeof REQUIRED_ENVS)[number]): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`🚨 [FATAL] 缺少关键配置项: ${key}`);
  }

  if (isUnsafeConfigValue(value)) {
    throw new Error(`🚨 [FATAL] ${key} 使用了弱值或占位值，请重新生成。`);
  }

  return value;
}

function isUnsafeConfigValue(value: string): boolean {
  return /(fallback|replace[_-]?with|placeholder|changeme|dummy|example)/i.test(
    value,
  );
}

function normalizePem(value: string, key: string): string {
  const unescaped = value.includes("-----BEGIN")
    ? value.replace(/\\n/g, "\n")
    : Buffer.from(value, "base64").toString("utf8").replace(/\\n/g, "\n");

  if (!unescaped.includes("-----BEGIN ") || !unescaped.includes("-----END ")) {
    throw new Error(`🚨 [FATAL] ${key} 必须是 PEM 或 PEM 的 base64 编码`);
  }

  return unescaped;
}

const JWT_PRIVATE_KEY = normalizePem(requireEnv(REQUIRED_ENVS[0]), REQUIRED_ENVS[0]);
const JWT_PUBLIC_KEY = normalizePem(requireEnv(REQUIRED_ENVS[1]), REQUIRED_ENVS[1]);
const ENCRYPTION_SECRET = requireEnv(REQUIRED_ENVS[2]);
const ENCRYPTION_SALT = requireEnv(REQUIRED_ENVS[3]);
requireEnv(REQUIRED_ENVS[4]);

// ========== 配置常量 ==========

// JWT 配置
export const JWT_CONFIG = {
  ALG: "RS256",
  ACCESS_TOKEN_TTL: process.env.JWT_ACCESS_TTL || "2h",
  REFRESH_TOKEN_TTL: process.env.JWT_REFRESH_TTL || "7d",
  ACCESS_TOKEN_MAX_AGE: 2 * 60 * 60, // 2 小时 (以秒为单位)
  REFRESH_TOKEN_MAX_AGE: 7 * 24 * 60 * 60, // 7 天 (以秒为单位)
  PRIVATE_KEY: JWT_PRIVATE_KEY,
  PUBLIC_KEY: JWT_PUBLIC_KEY,
} as const;

// 加密配置
export const ENCRYPTION_CONFIG = {
  SECRET: ENCRYPTION_SECRET,
  SALT: ENCRYPTION_SALT,
} as const;

// 速率限制配置
export const RATE_LIMIT_CONFIG = {
  SEARCH: {
    maxRequests: parseInt(process.env.RATE_LIMIT_SEARCH_MAX || "100", 10),
    windowMs: parseInt(
      process.env.RATE_LIMIT_SEARCH_WINDOW || String(60 * 60 * 1000),
      10,
    ),
  },
  IMPORT: {
    maxRequests: parseInt(process.env.RATE_LIMIT_IMPORT_MAX || "10", 10),
    windowMs: parseInt(
      process.env.RATE_LIMIT_IMPORT_WINDOW || String(60 * 60 * 1000),
      10,
    ),
  },
  PROGRESS: {
    maxRequests: parseInt(process.env.RATE_LIMIT_PROGRESS_MAX || "60", 10),
    windowMs: parseInt(
      process.env.RATE_LIMIT_PROGRESS_WINDOW || String(60 * 1000),
      10,
    ),
  },
  API: {
    maxRequests: parseInt(process.env.RATE_LIMIT_API_MAX || "30", 10),
    windowMs: parseInt(
      process.env.RATE_LIMIT_API_WINDOW || String(60 * 1000),
      10,
    ),
  },
  AUTH: {
    maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "5", 10), // 限制极严
    windowMs: parseInt(
      process.env.RATE_LIMIT_AUTH_WINDOW || String(60 * 1000),
      10,
    ),
  },
} as const;

// TMDB 配置
export const TMDB_CONFIG = {
  BASE_URL: process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3",
  IMAGE_BASE_URL:
    process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p/w500",
  API_KEY: process.env.TMDB_API_KEY || "",
  TIMEOUT: parseInt(process.env.TMDB_TIMEOUT || "10000", 10),
  RATE_LIMIT: {
    concurrency: parseInt(process.env.TMDB_CONCURRENCY || "4", 10),
    interval: parseInt(process.env.TMDB_INTERVAL || "1000", 10),
    intervalCap: parseInt(process.env.TMDB_INTERVAL_CAP || "4", 10),
  },
} as const;

// API 超时配置
export const API_TIMEOUT_CONFIG = {
  DEFAULT: parseInt(process.env.API_TIMEOUT_DEFAULT || "30000", 10), // 30 秒
  IMPORT: parseInt(process.env.API_TIMEOUT_IMPORT || "300000", 10), // 5 分钟
  SEARCH: parseInt(process.env.API_TIMEOUT_SEARCH || "10000", 10), // 10 秒
} as const;

// 定时任务配置
export const SCHEDULER_CONFIG = {
  SCAN_INTERVAL_HOURS: parseInt(process.env.SCAN_INTERVAL_HOURS || "1", 10),
} as const;
