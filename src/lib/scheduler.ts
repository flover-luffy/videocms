import { prisma } from "./db";
import { runImportTask } from "./import-task";
import { SCHEDULER_CONFIG } from "@/config";

declare global {
    var schedulerStarted: boolean | undefined;
    var importing: boolean | undefined;
    var importingTimeout: ReturnType<typeof setTimeout> | undefined;
}

/** 最长锁持有时间：20 分钟（扫描任务可能较慢） */
const IMPORT_LOCK_TIMEOUT_MS = 20 * 60 * 1000;

export function isImporting() {
    return !!globalThis.importing;
}

export function setImporting(value: boolean) {
    if (globalThis.importingTimeout) {
        clearTimeout(globalThis.importingTimeout);
        globalThis.importingTimeout = undefined;
    }
    globalThis.importing = value;
    if (value) {
        globalThis.importingTimeout = setTimeout(() => {
            console.warn("[Scheduler] 导入锁超时（20 分钟），强制释放防止死锁");
            globalThis.importing = false;
            globalThis.importingTimeout = undefined;
        }, IMPORT_LOCK_TIMEOUT_MS);
    }
}

/**
 * 启动定时调度器
 * 仅在 Node.js 运行时执行
 */
export function startScheduler() {
    if (globalThis.schedulerStarted) return;
    globalThis.schedulerStarted = true;

    console.log(`[Scheduler] 定时扫描任务已启动，间隔: ${SCHEDULER_CONFIG.SCAN_INTERVAL_HOURS} 小时`);

    // 立即执行一次初始化扫描
    setTimeout(() => performAutoScan(), 5000);

    // 设置循环
    const intervalMs = SCHEDULER_CONFIG.SCAN_INTERVAL_HOURS * 60 * 60 * 1000;
    setInterval(() => performAutoScan(), intervalMs);
}

/**
 * 执行自动全量扫描
 */
async function performAutoScan() {
    if (isImporting()) {
        console.log("[Scheduler] 正在进行其它导入任务，跳过本次自动扫描");
        return;
    }

    console.log("[Scheduler] 开始执行定时全量扫描记录更新...");
    setImporting(true);

    try {
        // 1. 获取所有剧集目录
        const series = await prisma.series.findMany({
            select: { openlistConfigId: true, sourcePath: true, title: true }
        });

        // 2. 获取所有音乐专辑目录
        const albums = await prisma.album.findMany({
            select: { openlistConfigId: true, sourcePath: true, title: true }
        });

        const allTasks = [
            ...series.map(s => ({ configId: s.openlistConfigId, path: s.sourcePath, title: s.title })),
            ...albums.map(a => ({ configId: a.openlistConfigId, path: a.sourcePath, title: a.title }))
        ];

        let successCount = 0;
        let failCount = 0;

        for (const task of allTasks) {
            try {
                await runImportTask(task.configId, task.path, task.title);
                successCount++;
            } catch (err) {
                console.error(`[Scheduler] 扫描路径失败: ${task.path}`, err);
                failCount++;
            }
        }

        console.log(`[Scheduler] 定时扫描完成。成功: ${successCount}, 失败: ${failCount}`);
    } catch (err) {
        console.error("[Scheduler] 定时扫描任务崩溃:", err);
    } finally {
        setImporting(false);
    }
}

