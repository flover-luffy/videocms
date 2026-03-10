/**
 * 应用配置中心
 * 统一管理所有配置项，避免硬编码
 */

// ========== 类型定义 ==========

export type JWTConfig = typeof JWT_CONFIG;
export type RateLimitConfig = typeof RATE_LIMIT_CONFIG;
export type TMDBConfig = typeof TMDB_CONFIG;

// ========== 配置常量 ==========

// JWT 配置
export const JWT_CONFIG = {
    ACCESS_TOKEN_TTL: process.env.JWT_ACCESS_TTL || "24h",
    REFRESH_TOKEN_TTL: process.env.JWT_REFRESH_TTL || "30d",
    ACCESS_TOKEN_MAX_AGE: 24 * 60 * 60, // 24 小时 (以秒为单位)
    REFRESH_TOKEN_MAX_AGE: 30 * 24 * 60 * 60, // 30 天 (以秒为单位)
    SECRET: process.env.JWT_SECRET || "fallback-dev-secret-do-not-use-in-production",
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
