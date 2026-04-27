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
import { cacheManager } from "@/lib/cache";

// 缓存配置
const LIST_CACHE_TTL = 300; // 5 分钟
const SCAN_DIRECTORY_CONCURRENCY = 4;

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
    let encodedPath = "";
    try {
      encodedPath = encodeURI(decodeURIComponent(fullPath));
    } catch {
      encodedPath = encodeURI(fullPath);
    }
    return `${this.host}/d${encodedPath}?sign=${sign}`;
  }

  /** 将输入路径统一处理为从根节点起始的绝对路径风格 */
  private resolvePath(subPath: string): string {
    const cleaned = subPath.trim();
    if (cleaned === "" || cleaned === "/")
      return this.rootPath === "/" ? "/" : this.rootPath;

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
  private async post<T>(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<T> {
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
              throw new Error(
                `OpenList API HTTP ${res.status}: ${await res.text()}`,
              );
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
        },
      );
    });
  }

  /**
   * 列出指定路径下的文件/文件夹
   * POST /api/fs/list
   * 已接入 CacheManager 缓存
   */
  async listDir(path: string): Promise<OpenListFile[]> {
    const finalPath = this.resolvePath(path);
    const cacheKey = `openlist_list:${this.host}:${finalPath}`;
    const cache = cacheManager.getCache<OpenListFile[]>("openlist");

    return cache.getOrSet(
      cacheKey,
      async () => {
        const resp = await this.post<OpenListListResponse>("/api/fs/list", {
          path: finalPath,
          password: "",
          page: 1,
          per_page: 0,
          refresh: true,
        });

        if (resp.code !== 200) {
          throw new Error(
            `listDir 失败 [${resp.code}]: ${resp.message} (path=${finalPath})`,
          );
        }

        return resp.data.content ?? [];
      },
      LIST_CACHE_TTL,
    );
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
      throw new Error(
        `getFile 失败 [${resp.code}]: ${resp.message} (path=${finalPath})`,
      );
    }

    return resp.data;
  }

  /**
   * 递归扫描目录，返回所有媒体文件列表
   * 已改为并行化扫描以极大提升性能
   */
  async scanDirectory(rootPath: string, maxDepth = 5): Promise<ScannedItem[]> {
    const results: ScannedItem[] = [];
    const startPath = this.resolvePath(rootPath);

    // 并发控制：由于这是递归，传统的 Promise.all 可能会导致瞬间 QPS 过高
    // 此处使用一个简单的任务队列或 Promise.all 的层级并发
    const recurse = async (
      currentAbsolutePath: string,
      depth: number,
    ): Promise<void> => {
      if (depth > maxDepth) return;

      let files: OpenListFile[];
      try {
        files = await this.listDir(currentAbsolutePath);
      } catch (err) {
        console.error(
          `[OpenList] 扫描目录失败: ${currentAbsolutePath}`,
          err instanceof Error ? err.message : err,
        );
        return;
      }

      const folders: string[] = [];
      for (const file of files) {
        const fullPath = `${currentAbsolutePath}/${file.name}`.replace(
          /\/+/g,
          "/",
        );
        if (file.is_dir) {
          folders.push(fullPath);
        } else {
          const category = classifyFile(file.name);
          if (category === "other") continue;

          const parsed = parseEpisodeNum(file.name);
          results.push({
            path: fullPath,
            name: file.name,
            size: file.size,
            category,
            seasonNum: parsed?.seasonNum,
            episodeNum: parsed?.episodeNum,
          });
        }
      }

      if (folders.length > 0) {
        for (let i = 0; i < folders.length; i += SCAN_DIRECTORY_CONCURRENCY) {
          const batch = folders.slice(i, i + SCAN_DIRECTORY_CONCURRENCY);
          await Promise.all(batch.map((folder) => recurse(folder, depth + 1)));
        }
      }
    };

    await recurse(startPath, 0);

    return results.map((r) => {
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
export function createOpenListClient(
  host: string,
  token: string,
): OpenListClient {
  return new OpenListClient(host, token);
}
