import PQueue from "p-queue";
import { prisma } from "./db";
import { runImportTask } from "./import-task";

declare global {
    var schedulerStarted: boolean | undefined;
    var importing: boolean | undefined;
    var importingTimeout: ReturnType<typeof setTimeout> | undefined;
}

/** 
 * 限制并发扫描数，防止瞬时拉高 VPS 负载
 * 默认并发为 2，间隔 1s 启动下一个
 */
const scanQueue = new PQueue({ concurrency: 2, interval: 1000, intervalCap: 1 });

/** 最长锁持有时间：10 分钟。超时后强制释放，防止任务异常导致永久锁死 */
const IMPORT_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export function isImporting() {
    return !!globalThis.importing;
}

export function setImporting(value: boolean) {
    // 清除上一个超时定时器
    if (globalThis.importingTimeout) {
        clearTimeout(globalThis.importingTimeout);
        globalThis.importingTimeout = undefined;
    }
    globalThis.importing = value;
    // 加锁时设置超时保障
    if (value) {
        globalThis.importingTimeout = setTimeout(() => {
            console.warn("[Scheduler] 导入锁超时（10 分钟），强制释放防止死锁");
            globalThis.importing = false;
            globalThis.importingTimeout = undefined;
        }, IMPORT_LOCK_TIMEOUT_MS);
    }
}

export function startScheduler() {
    if (globalThis.schedulerStarted) return;
    globalThis.schedulerStarted = true;

    // 间隔配置化支持 (默认 60s)
    const intervalSeconds = parseInt(process.env.SCAN_INTERVAL || "60", 10);
    console.log(`[Scheduler] 定时扫描引擎已启动 (每 ${intervalSeconds} 秒运行一次)`);

    setInterval(async () => {
        if (globalThis.importing) {
            console.log("[Scheduler] 上次扫描尚未结束，跳过本次轮询");
            return;
        }
        setImporting(true);

        try {
            const configs = await prisma.openlistConfig.findMany();
            if (configs.length === 0) return;

            // 使用 PQueue 并发处理各配置扫描任务
            await Promise.all(configs.map((config: { id: number; name: string }) => scanQueue.add(async () => {
                try {
                    const result = await runImportTask(config.id, "/");
                    if (result.newEpisodes && result.newEpisodes > 0) {
                        console.log(`[Scheduler] 发现新剧集! 连接: ${config.name}, 新增集数: ${result.newEpisodes}`);
                    }
                    if (result.newTracks && result.newTracks > 0) {
                        console.log(`[Scheduler] 发现新音乐! 连接: ${config.name}, 新增轨数: ${result.newTracks}`);
                    }
                } catch (err: unknown) {
                    console.error(`[Scheduler] 扫描异常 (连接: ${config.name}):`, err instanceof Error ? err.message : err);
                }
            })));
        } catch (e) {
            console.error("[Scheduler] 数据库访问失败:", e);
        } finally {
            setImporting(false);
        }
    }, intervalSeconds * 1000);
}
