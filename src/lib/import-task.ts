import { prisma } from "./db";
import { MediaService } from "@/services/media.service";
import type { ScannedItem } from "@/types";
import { cleanSeriesTitle, normalizePath } from "./openlist/utils";
import { getStorageProvider } from "./storage/factory";
import { OpenListProvider } from "./storage/providers/openlist";

/**
 * 核心导入任务执行函数
 * 扫描指定 OpenList 配置下的目录，按层级智能分组后批量导入影视/音乐
 */
export async function runImportTask(configId: number, path: string, manualTitle?: string) {
    const config = await prisma.openlistConfig.findUnique({ where: { id: configId } });
    if (!config) {
        throw new Error("OpenList 配置不存在");
    }

    // 验证路径安全性
    if (path.includes("..") || path.includes("//")) {
        throw new Error("无效的路径格式");
    }

    // 清理和规范化标题
    const sanitizedTitle = manualTitle
        ?.trim()
        .replace(/[<>:"/\\|?*]/g, "")
        .slice(0, 255) || undefined;

    const provider = getStorageProvider(config);

    // 1. 全量广域扫描
    let scanned: ScannedItem[];
    try {
        if (provider instanceof OpenListProvider) {
            scanned = await provider.scanDirectory(path);
        } else {
            scanned = await provider.listDir(path);
        }
    } catch (err) {
        console.error(`[ImportTask] 扫描失败 (configId=${configId}, path=${path}):`, err);
        throw new Error("扫描存储目录失败");
    }

    if (scanned.length === 0) {
        return { success: true, batchCount: 0, newEpisodes: 0, newTracks: 0, results: [], message: "未发现任何可识别的媒体文件" };
    }

    // 2. 智能层级识别与分组（自底向上探测法）
    const getSeriesKey = (item: ScannedItem) => {
        const normalizedItemPath = normalizePath(item.path);
        const parts = normalizedItemPath.split("/").filter(Boolean);

        // 只有文件名，没有父目录时归入根组
        if (parts.length <= 1) return "__ROOT__";

        let seriesIndex = parts.length - 2;

        // 智能探测：若直接父目录是"季"特征夹（Season 1, S01, 第二季等），则向上回溯一级
        const seasonRegex = /^(season|s|第)\s*\d+/i;
        if (seriesIndex > 0 && seasonRegex.test(parts[seriesIndex])) {
            seriesIndex--;
        }

        return normalizePath(parts.slice(0, seriesIndex + 1).join("/"));
    };

    const groups = new Map<string, { videos: ScannedItem[] }>();
    const audioItems: ScannedItem[] = [];
    const imageItems: ScannedItem[] = [];

    for (const item of scanned) {
        if (item.category === "audio") {
            audioItems.push(item);
            continue;
        }
        if (item.category === "image") {
            imageItems.push(item);
            continue;
        }
        const key = getSeriesKey(item);
        if (!groups.has(key)) {
            groups.set(key, { videos: [] });
        }
        const group = groups.get(key)!;
        if (item.category === "video") group.videos.push(item);
    }

    // ── 情况 A: 纯音乐导入 ──
    if (audioItems.length > 0 && groups.size === 0) {
        const inferredTitle = sanitizedTitle ?? path.split("/").filter(Boolean).pop() ?? "未命名专辑";
        const data = await MediaService.importMusic({
            inferredTitle,
            path: path,
            configId: configId,
            audios: audioItems,
            images: imageItems,
            configHost: config.host,
            configToken: config.token,
        });
        return { success: true, newTracks: data.newTracks, batchCount: 1, results: [data] };
    }

    // ── 情况 B: 影视导入（支持多剧集拆分） ──
    const results = [];
    let totalEpisodes = 0;

    for (const [key, group] of groups.entries()) {
        if (group.videos.length === 0) continue;

        let currentTitle = key === "__ROOT__"
            ? (sanitizedTitle ?? path.split("/").filter(Boolean).pop() ?? "未命名剧集")
            : key.split("/").filter(Boolean).pop() || "未命名剧集";

        currentTitle = cleanSeriesTitle(currentTitle);

        const currentPath = key === "__ROOT__" ? normalizePath(path) : key;

        const data = await MediaService.importSeries({
            inferredTitle: currentTitle,
            path: currentPath,
            configId: configId,
            videos: group.videos,
        });

        results.push(data);
        totalEpisodes += data.newEpisodes || 0;
    }

    return {
        success: true,
        batchCount: results.length,
        newEpisodes: totalEpisodes,
        results
    };
}
