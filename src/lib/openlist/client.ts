/**
 * OpenList API 客户端
 * 封装所有与 OpenList/AList 通信的接口调用
 */
import type {
    OpenListListResponse,
    OpenListGetResponse,
    OpenListFile,
    ScannedItem,
} from "@/types";
import { classifyFile, parseEpisodeNum } from "./utils";
import { withRetry } from "../retry-utils";
import { openlistCircuitBreaker } from "@/lib/circuit-breaker";

// ───────────────────────────────────────────────────────
// OpenList 客户端类
// ───────────────────────────────────────────────────────

export class OpenListClient {
    private readonly host: string;
    private readonly token: string;
    private readonly timeout: number;
    private readonly rootPath: string;

    constructor(host: string, token: string, timeout = 15000) {
        let baseUrl = host.trim().replace(/\/$/, "");
        let detectedPath = "/";

        try {
            if (baseUrl.startsWith("http")) {
                const url = new URL(baseUrl);
                if (url.pathname && url.pathname !== "/") {
                    detectedPath = url.pathname;
                    baseUrl = url.origin;
                }
            }
        } catch {
            // 解析失败时回退
        }

        this.host = baseUrl;
        this.rootPath = detectedPath;
        this.token = token;
        this.timeout = timeout;
    }

    /** 获取解析出的根路径 */
    public getRootPath(): string {
        return this.rootPath;
    }

    /**
     * 构造 OpenList 代理直链
     * 自动补全 rootPath，并处理编码问题防止双重编码
     */
    public getProxyUrl(subPath: string, sign: string): string {
        const fullPath = this.resolvePath(subPath);
        // 先解码再编码，确保不会出现 %25 (即 % 被重复编码)
        const encodedPath = encodeURI(decodeURIComponent(fullPath));
        return `${this.host}/d${encodedPath}?sign=${sign}`;
    }

    /** 将输入路径统一处理为从根节点起始的绝对路径风格 */
    private resolvePath(subPath: string): string {
        const cleaned = subPath.trim();
        if (cleaned === "" || cleaned === "/") return this.rootPath === "/" ? "/" : this.rootPath;

        // 规范化路径，去除冗余的 /
        let normalized = ("/" + cleaned).replace(/\/+/g, "/").replace(/\/$/, "");

        // 如果内部已经存在 rootPath 前缀了，不要重复拼接
        // 关键修复：确保 rootPath 不是以 "/" 结尾，避免 startsWith 判断失效
        const root = this.rootPath.replace(/\/$/, "");
        if (root !== "" && root !== "/" && !normalized.startsWith(root)) {
            normalized = (root + "/" + normalized).replace(/\/+/g, "/");
        }

        return normalized;
    }

    /** 发起带 Token 认证的 POST 请求（带重试和熔断器保护） */
    private async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
        return openlistCircuitBreaker.execute(async () => {
            return withRetry(
                async () => {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), this.timeout);

                    try {
                        const res = await fetch(`${this.host}${endpoint}`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: this.token,
                            },
                            body: JSON.stringify(body),
                            signal: controller.signal,
                        });

                        if (!res.ok) {
                            throw new Error(`OpenList API HTTP ${res.status}: ${await res.text()}`);
                        }

                        const json = (await res.json()) as T;
                        return json;
                    } finally {
                        clearTimeout(timer);
                    }
                },
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 10000,
                    backoffMultiplier: 2,
                }
            );
        });
    }

    /**
     * 列出指定路径下的文件/文件夹
     * POST /api/fs/list
     */
    async listDir(path: string): Promise<OpenListFile[]> {
        const finalPath = this.resolvePath(path);
        const resp = await this.post<OpenListListResponse>("/api/fs/list", {
            path: finalPath,
            password: "",
            page: 1,
            per_page: 0,
            refresh: false,
        });

        if (resp.code !== 200) {
            throw new Error(`listDir 失败 [${resp.code}]: ${resp.message} (path=${finalPath})`);
        }

        return resp.data.content ?? [];
    }

    /**
     * 获取单个文件的详细信息（含 raw_url 直链）
     * POST /api/fs/get
     */
    async getFile(path: string): Promise<OpenListGetResponse["data"]> {
        const finalPath = this.resolvePath(path);
        const resp = await this.post<OpenListGetResponse>("/api/fs/get", {
            path: finalPath,
            password: "",
        });

        if (resp.code !== 200) {
            throw new Error(`getFile 失败 [${resp.code}]: ${resp.message} (path=${finalPath})`);
        }

        return resp.data;
    }

    /**
     * 递归扫描目录，返回所有媒体文件列表
     * @param rootPath  外部传入的扫描起点目录（相对配置根的相对或绝对路径皆可）
     * @param maxDepth  最大递归深度（默认 5）
     */
    async scanDirectory(rootPath: string, maxDepth = 5): Promise<ScannedItem[]> {
        const results: ScannedItem[] = [];

        // 关键：此处统一将其转化为可信的绝对路径，交给 recurse 去发起最终请求。
        // 因为 recurse 里传给 listDir 的总是上一层返回拼接好的路径。
        const startPath = this.resolvePath(rootPath);

        const recurse = async (currentAbsolutePath: string, depth: number): Promise<void> => {
            if (depth > maxDepth) return;

            let files: OpenListFile[];
            try {
                // currentAbsolutePath 已经是经过 resolvePath 洗礼的规范路径了，
                // 由于 listDir 里还会 resolvePath，因此刚才我们在 resolvePath 里加入了容错机制
                files = await this.listDir(currentAbsolutePath);
            } catch (err) {
                console.error(`[OpenList] 扫描目录失败: ${currentAbsolutePath}`, err instanceof Error ? err.message : err);
                return;
            }

            for (const file of files) {
                // file.name 只是基本文件名，需与其父目录相拼接形成该文件的完整绝对路径
                const fullPath = `${currentAbsolutePath}/${file.name}`.replace(/\/+/g, "/");

                if (file.is_dir) {
                    await recurse(fullPath, depth + 1);
                } else {
                    const category = classifyFile(file.name);
                    if (category === "other") continue;

                    const parsed = parseEpisodeNum(file.name);
                    results.push({
                        // 重要：为了外部 getSeriesKey 中的相对剥离操作能准确执行，
                        // 我们需要暴露出原始未携带 rootPath 前缀的“业务相对路径”
                        // 或者是，在 import-task 中提供处理过的方法。此处最好暴露相对根存储器的规范路径。
                        path: fullPath,
                        name: file.name,
                        size: file.size,
                        category,
                        seasonNum: parsed?.seasonNum,
                        episodeNum: parsed?.episodeNum,
                    });
                }
            }
        };

        await recurse(startPath, 0);

        // 核心改动：不再去除结果路径中的 rootPath 前缀。
        // 数据库中存储从 Alist 根目录起始的绝对路径，确保 API 构造链接时偏移量永远正确。
        return results.map(r => {
            // 确保输出的业务路径前带有 "/"
            const p = ("/" + r.path).replace(/\/+/g, "/");
            return { ...r, path: p };
        });
    }

    /**
     * 测试连接是否正常
     * 关键修复：使用解析出的 rootPath 而非 "/" 进行探测，因为 Token 可能只有局部权限
     */
    async ping(): Promise<boolean> {
        try {
            await this.listDir(this.rootPath);
            return true;
        } catch (err) {
            console.error("[OpenList Ping] 失败:", err);
            return false;
        }
    }
}

/** 根据 DB 配置创建客户端实例 */
export function createOpenListClient(host: string, token: string): OpenListClient {
    return new OpenListClient(host, token);
}
