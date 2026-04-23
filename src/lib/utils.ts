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
      return input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
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

export interface TmdbParsedMetadata {
  originalTitle?: string;
  status?: string; // enum mapping e.g "Ended"
  statusLabel?: string; // Localized "已完结", "连载中"
  releaseDate?: string; // first_air_date or release_date
  tagline?: string;
  networks?: string[];
  productionCompanies?: string[];
  directors?: string[];
  runtime?: number; // episode_run_time[0] or runtime
}

/**
 * 提取未固定结构的 tmdbData 字段，归一化输出给页面做强化渲染
 */
export function parseTmdbMetadata(tmdbData: unknown): TmdbParsedMetadata {
  const data = safeJsonParse<Record<string, unknown>>(tmdbData, {});

  type TmdbItem = Record<string, unknown>;
  const networks = Array.isArray(data.networks)
    ? data.networks
        .map((n: TmdbItem) =>
          typeof (typeof n.name === "string" ? n.name : "") === "string"
            ? typeof n.name === "string"
              ? n.name
              : ""
            : "",
        )
        .filter(Boolean)
    : [];
  const productionCompanies = Array.isArray(data.production_companies)
    ? data.production_companies
        .map((c: TmdbItem) =>
          typeof (typeof c.name === "string" ? c.name : "") === "string"
            ? typeof c.name === "string"
              ? c.name
              : ""
            : "",
        )
        .filter(Boolean)
    : [];

  // TV Series 存在 created_by 属性作为导演/制作人
  const directors = Array.isArray(data.created_by)
    ? data.created_by
        .map((c: TmdbItem) =>
          typeof (typeof c.name === "string" ? c.name : "") === "string"
            ? typeof c.name === "string"
              ? c.name
              : ""
            : "",
        )
        .filter(Boolean)
    : [];

  const rawStatus = typeof data.status === "string" ? data.status : "";
  let statusLabel = "";
  switch (rawStatus.toLowerCase()) {
    case "ended":
      statusLabel = "已完结";
      break;
    case "returning series":
      statusLabel = "连载中";
      break;
    case "canceled":
      statusLabel = "已取消";
      break;
    case "released":
      statusLabel = "已上映";
      break;
    case "in production":
      statusLabel = "制作中";
      break;
    case "post production":
      statusLabel = "后期制作";
      break;
    case "planned":
      statusLabel = "计划中";
      break;
    default:
      statusLabel = rawStatus;
      break;
  }

  const getString = (val: unknown) => typeof val === "string" ? val : "";
  const releaseDate = getString(data.first_air_date) || getString(data.release_date);
  const runtime =
    Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
      ? data.episode_run_time[0]
      : data.runtime || 0;

  return {
    originalTitle: getString(data.original_name) || getString(data.original_title),
    status: rawStatus,
    statusLabel,
    releaseDate,
    tagline: getString(data.tagline),
    networks,
    productionCompanies,
    directors,
    runtime: typeof runtime === "number" ? runtime : 0,
  };
}
