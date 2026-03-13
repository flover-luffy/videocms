import { config } from "dotenv";
import path from "path";

// 强制加载环境配置：解决某些运行时环境下 process.env 不及时的 Bug
config({ path: path.resolve(process.cwd(), ".env") });

/**
 * 应用配置中心
 * 统一管理所有配置项，避免硬编码
 */

// 核心环境变量列表
const REQUIRED_ENVS = ["JWT_SECRET", "ENCRYPTION_SECRET", "DATABASE_URL"] as const;

// ====== 生产环境执行期强制校验（自动放行 Docker 构建期预扫描） ======
// 构建期标识判定：命令行含有 build、存在 NEXT_PHASE、或 CI 标识
const commandArgs = process.argv.join(' ');
const isBuild =
    process.env.npm_lifecycle_event === "build" ||
    commandArgs.includes('build') ||
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export' ||
    process.env.CI === 'true' ||
    process.env.NODE_ENV !== "production"; // 非纯后端运行时的豁免

if (process.env.NODE_ENV === "production" && !isBuild) {
    for (const key of REQUIRED_ENVS) {
        if (!process.env[key]) {
            throw new Error(`🚨 [FATAL] 生产环境缺少关键配置项: ${key}`);
        }
    }
} else if (!isBuild) {
    // 开发环境友好警告
    for (const key of REQUIRED_ENVS) {
        if (!process.env[key]) {
            console.warn(`⚠️ [SECURITY] 未配置 ${key}，系统将使用开发模式 fallback。若已在 .env 中配置，请重启服务。`);
        }
    }
}

// Sentry (GlitchTip) 配置
export const SENTRY_CONFIG = {
    DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://placeholder@app.glitchtip.com/1",
} as const;

// ========== 配置常量 ==========

// JWT 配置
export const JWT_CONFIG = {
    ACCESS_TOKEN_TTL: process.env.JWT_ACCESS_TTL || "2h",
    REFRESH_TOKEN_TTL: process.env.JWT_REFRESH_TTL || "7d",
    ACCESS_TOKEN_MAX_AGE: 2 * 60 * 60, // 2 小时 (以秒为单位)
    REFRESH_TOKEN_MAX_AGE: 7 * 24 * 60 * 60, // 7 天 (以秒为单位)
    // 必须与重构前的原始代码 (jwt.ts) 默认值保持一致，否则 fallback 模式下旧 token 会失效
    SECRET: process.env.JWT_SECRET || "fallback-dev-secret-do-not-use-in-production",
} as const;

// 加密配置
export const ENCRYPTION_CONFIG = {
    // 必须与重构前的原始代码 (encryption.ts) 默认值保持一致，否则原有加密数据将无法解密
    SECRET: process.env.ENCRYPTION_SECRET || "fallback-secret",
    SALT: process.env.ENCRYPTION_SALT || "fallback-salt",
} as const;

// 速率限制配置
export const RATE_LIMIT_CONFIG = {
    SEARCH: {
        maxRequests: parseInt(process.env.RATE_LIMIT_SEARCH_MAX || "100", 10),
        windowMs: parseInt(process.env.RATE_LIMIT_SEARCH_WINDOW || String(60 * 60 * 1000), 10),
    },
    IMPORT: {
        maxRequests: parseInt(process.env.RATE_LIMIT_IMPORT_MAX || "10", 10),
        windowMs: parseInt(process.env.RATE_LIMIT_IMPORT_WINDOW || String(60 * 60 * 1000), 10),
    },
    PROGRESS: {
        maxRequests: parseInt(process.env.RATE_LIMIT_PROGRESS_MAX || "60", 10),
        windowMs: parseInt(process.env.RATE_LIMIT_PROGRESS_WINDOW || String(60 * 1000), 10),
    },
    API: {
        maxRequests: parseInt(process.env.RATE_LIMIT_API_MAX || "30", 10),
        windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW || String(60 * 1000), 10),
    },
} as const;

// TMDB 配置
export const TMDB_CONFIG = {
    BASE_URL: process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3",
    IMAGE_BASE_URL: process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p/w500",
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
