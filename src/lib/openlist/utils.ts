/**
 * OpenList 解析工具库
 * 专注于文件名的元数据提取与分类判断
 */
import type { FileCategory } from "@/types";

/** 支持的视频后缀 */
export const VIDEO_EXTS = new Set([".mp4", ".mkv", ".avi", ".mov", ".flv", ".webm", ".m3u8", ".ts"]);
/** 支持的音频后缀 */
export const AUDIO_EXTS = new Set([".mp3", ".flac", ".aac", ".m4a", ".ogg", ".wav", ".ape"]);

/** 集数识别正则列表（按优先级排序） */
export const EPISODE_PATTERNS = [
    /[Ss](\d{1,2})[Ee](\d{1,3})/,        // S01E02
    /第\s*(\d+)\s*[集话期]/,               // 第1集、第01话
    /EP\s*0*(\d+)/i,                       // EP01, ep1
    /[-_\s.](\d{1,3})[-_\s.]/,            // -01- _1_
    /^(\d{1,3})[.\s]/,                     // 01. 02.
];

/** 获取文件扩展名（小写） */
function getExt(name: string): string {
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

/** 规范化路径：确保以 / 开头，无重复斜杠，且无末尾斜杠 */
export function normalizePath(path: string): string {
    if (!path) return "/";
    let normalized = ("/" + path).replace(/\/+/g, "/");
    if (normalized.length > 1 && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

/** 判断文件分类 */
export function classifyFile(name: string): FileCategory {
    const ext = getExt(name);
    if (VIDEO_EXTS.has(ext)) return "video";
    if (AUDIO_EXTS.has(ext)) return "audio";
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "image";
    return "other";
}

/** 从文件名识别集数（返回 episodeNum，以及可选 seasonNum） */
export function parseEpisodeNum(name: string): { seasonNum: number; episodeNum: number } | null {
    // 检测 S01E02 类型
    const seMatch = name.match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
    if (seMatch) {
        return { seasonNum: parseInt(seMatch[1], 10), episodeNum: parseInt(seMatch[2], 10) };
    }

    // 其余只识别集数，季默认为 1
    for (const pattern of EPISODE_PATTERNS.slice(1)) {
        const m = name.match(pattern);
        if (m) {
            return { seasonNum: 1, episodeNum: parseInt(m[1], 10) };
        }
    }
    return null;
}
/** 清理剧集标题，移除 [全XX集]、(202X) 等冗余后缀 */
export function cleanSeriesTitle(title: string): string {
    return title
        .replace(/\[\s*全\s*\d+\s*[集话期]\s*\]/gi, "")
        .replace(/第\s*\d+\s*[季部]/g, "")
        .replace(/\(\s*\d{4}\s*\)/g, "")
        .replace(/HD|1080P|4K|蓝光|国语|中英字幕/gi, "")
        .replace(/\s*[\[（(【].*?[\]）)】]\s*/g, " ") // 移除所有常见括号内容
        .replace(/\s+/g, " ") // 合并空格
        .trim();
}
