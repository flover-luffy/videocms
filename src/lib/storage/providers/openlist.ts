import { StorageProvider } from "../types";
import { OpenListClient } from "@/lib/openlist/client";
import { ScannedItem } from "@/types";
import { classifyFile, parseEpisodeNum } from "@/lib/openlist/utils";

/**
 * OpenList / AList V3 存储提供商实现
 */
export class OpenListProvider implements StorageProvider {
    readonly providerName = "OpenList";
    private client: OpenListClient;

    constructor(host: string, token: string) {
        this.client = new OpenListClient(host, token);
    }

    async listDir(path: string): Promise<ScannedItem[]> {
        const files = await this.client.listDir(path);
        return files.map(file => {
            const fullPath = `${path}/${file.name}`.replace(/\/+/g, "/");
            const category = classifyFile(file.name);
            const parsed = parseEpisodeNum(file.name);
            return {
                path: fullPath,
                name: file.name,
                size: file.size,
                category,
                seasonNum: parsed?.seasonNum,
                episodeNum: parsed?.episodeNum,
                isDir: file.is_dir,
            };
        });
    }

    async getFile(path: string): Promise<{ raw_url: string; size: number; name: string; modified?: string }> {
        const data = await this.client.getFile(path);
        return {
            raw_url: data.raw_url,
            size: data.size,
            name: data.name,
            modified: data.modified
        };
    }

    /** 保持对递归扫描的内部支持（优化用） */
    async scanDirectory(path: string, maxDepth = 5): Promise<ScannedItem[]> {
        return this.client.scanDirectory(path, maxDepth);
    }
}
