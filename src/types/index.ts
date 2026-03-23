/** 全局共用类型定义 */

// ── OpenList 接口响应类型 ──────────────────────────
export interface OpenListFile {
  name: string;
  size: number;
  is_dir: boolean;
  modified: string;
  created: string;
  sign: string;
  thumb: string;
  /** 文件类型枚举：1=文件夹，2=视频，3=音频，4=文本，5=图片 */
  type: number;
}

export interface OpenListListResponse {
  code: number;
  message: string;
  data: {
    content: OpenListFile[];
    total: number;
    readme: string;
    provider: string;
  };
}

export interface OpenListGetResponse {
  code: number;
  message: string;
  data: {
    name: string;
    size: number;
    is_dir: boolean;
    modified: string;
    sign: string;
    thumb: string;
    type: number;
    raw_url: string;
    related: Array<{ name: string; raw_url: string }> | null;
  };
}

// ── 文件分类类型 ──────────────────────────────────
export type FileCategory = "video" | "audio" | "image" | "other";

// ── 视频扫描结果 ──────────────────────────────────
export interface ScannedItem {
  path: string;
  name: string;
  size: number;
  category: FileCategory;
  seasonNum?: number;
  episodeNum?: number;
  isDir?: boolean;
}

// ── 播放数据 ──────────────────────────────────────
export interface PlayUrlResult {
  url: string;
  rawUrl?: string;
  subtitles?: Array<{
    url: string;
    name: string;
    type?: "vtt" | "srt" | "ass";
  }>;
}

// ── JWT Payload ──────────────────────────────────
export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  jti?: string;
  iat?: number;
  exp?: number;
}
