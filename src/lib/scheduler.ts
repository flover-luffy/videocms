import { prisma } from "./db";
import { runImportTask } from "./import-task";
import { cleanupExpiredTokens } from "./auth/token-blacklist";
import { SCHEDULER_CONFIG } from "@/config";
import { withDistributedLock } from "@/lib/cache";

declare global {
  var schedulerStarted: boolean | undefined;
  var importing: boolean | undefined;
  var importingTimeout: ReturnType<typeof setTimeout> | undefined;
}

/** 最长锁持有时间：20 分钟（扫描任务可能较慢） */
const IMPORT_LOCK_TIMEOUT_MS = 20 * 60 * 1000;

// ── Scheduler 可观测性状态 ──
interface SchedulerState {
  isRunning: boolean;
  startedAt: string | null;
  lastScanTime: string | null;
  lastScanResult: {
    success: boolean;
    successCount: number;
    failCount: number;
    totalTasks: number;
    durationMs: number;
  } | null;
  nextScheduledScan: string | null;
  scanIntervalHours: number;
  isCurrentlyImporting: boolean;
}

const schedulerState: SchedulerState = {
  isRunning: false,
  startedAt: null,
  lastScanTime: null,
  lastScanResult: null,
  nextScheduledScan: null,
  scanIntervalHours: SCHEDULER_CONFIG.SCAN_INTERVAL_HOURS,
  isCurrentlyImporting: false,
};

/** 获取 scheduler 当前运行状态（用于 API 可观测性） */
export function getSchedulerStatus(): Readonly<SchedulerState> {
  return {
    ...schedulerState,
    isCurrentlyImporting: isImporting(),
  };
}

export function isImporting() {
  return !!globalThis.importing;
}

export function setImporting(value: boolean) {
  if (globalThis.importingTimeout) {
    clearTimeout(globalThis.importingTimeout);
    globalThis.importingTimeout = undefined;
  }
  globalThis.importing = value;
  schedulerState.isCurrentlyImporting = value;
  if (value) {
    globalThis.importingTimeout = setTimeout(() => {
      console.warn("[Scheduler] 导入锁超时（20 分钟），强制释放防止死锁");
      globalThis.importing = false;
      globalThis.importingTimeout = undefined;
      schedulerState.isCurrentlyImporting = false;
    }, IMPORT_LOCK_TIMEOUT_MS);
  }
}

/** 计算下次扫描时间并更新状态 */
function updateNextScanTime() {
  const intervalMs = SCHEDULER_CONFIG.SCAN_INTERVAL_HOURS * 60 * 60 * 1000;
  schedulerState.nextScheduledScan = new Date(
    Date.now() + intervalMs,
  ).toISOString();
}

/**
 * 启动定时调度器
 * 仅在 Node.js 运行时执行
 */
export function startScheduler() {
  if (globalThis.schedulerStarted) return;
  globalThis.schedulerStarted = true;

  schedulerState.isRunning = true;
  schedulerState.startedAt = new Date().toISOString();
  schedulerState.scanIntervalHours = SCHEDULER_CONFIG.SCAN_INTERVAL_HOURS;

  console.info(
    `[Scheduler] ✅ 定时扫描任务已启动，间隔: ${SCHEDULER_CONFIG.SCAN_INTERVAL_HOURS} 小时`,
  );

  // 立即执行一次初始化扫描
  setTimeout(() => performAutoScan(), 5000);

  // 设置循环
  const intervalMs = SCHEDULER_CONFIG.SCAN_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(() => performAutoScan(), intervalMs);
  updateNextScanTime();

  // 启动 Token 清理定时任务（每天凌晨 2:00）
  startTokenCleanupJob();
}

/**
 * 手动触发一次全量扫描（供 API 调用）
 * 返回扫描是否成功启动
 */
export async function triggerManualScan(): Promise<{
  triggered: boolean;
  message: string;
}> {
  if (isImporting()) {
    return {
      triggered: false,
      message: "当前已有导入任务正在执行，请稍后再试",
    };
  }

  // 异步启动扫描，不阻塞响应
  performAutoScan().catch((err) => {
    console.error("[Scheduler] 手动触发的扫描异常:", err);
  });

  return {
    triggered: true,
    message: "手动扫描已触发，正在后台执行",
  };
}

/**
 * 执行自动全量扫描
 */
async function performAutoScan() {
  if (isImporting()) {
    console.info("[Scheduler] 正在进行其它导入任务，跳过本次自动扫描");
    return;
  }

  const locked = await withDistributedLock("import", 20 * 60, async () => {
    await performAutoScanLocked();
    return true;
  });

  if (!locked) {
    console.info("[Scheduler] 其它实例正在导入，跳过本次自动扫描");
  }
}

async function performAutoScanLocked() {
  const scanStartTime = Date.now();
  console.info("[Scheduler] 开始执行定时全量扫描记录更新...");
  setImporting(true);

  try {
    // 1. 获取所有剧集目录
    const series = await prisma.series.findMany({
      select: { openlistConfigId: true, sourcePath: true, title: true },
    });

    // 2. 获取所有音乐专辑目录
    const albums = await prisma.album.findMany({
      select: { openlistConfigId: true, sourcePath: true, title: true },
    });

    const allTasks = [
      ...series.map((s) => ({
        configId: s.openlistConfigId,
        path: s.sourcePath,
        title: s.title,
      })),
      ...albums.map((a) => ({
        configId: a.openlistConfigId,
        path: a.sourcePath,
        title: a.title,
      })),
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

    const durationMs = Date.now() - scanStartTime;

    // 更新可观测状态
    schedulerState.lastScanTime = new Date().toISOString();
    schedulerState.lastScanResult = {
      success: failCount === 0,
      successCount,
      failCount,
      totalTasks: allTasks.length,
      durationMs,
    };
    updateNextScanTime();

    console.info(
      `[Scheduler] 定时扫描完成。成功: ${successCount}, 失败: ${failCount}, 耗时: ${durationMs}ms`,
    );
  } catch (err) {
    const durationMs = Date.now() - scanStartTime;
    schedulerState.lastScanTime = new Date().toISOString();
    schedulerState.lastScanResult = {
      success: false,
      successCount: 0,
      failCount: 0,
      totalTasks: 0,
      durationMs,
    };
    console.error("[Scheduler] 定时扫描任务崩溃:", err);
  } finally {
    setImporting(false);
  }
}

/**
 * Token 清理定时任务
 * 每天凌晨 2:00 清理过期的 Token 黑名单记录
 */
declare global {
  var cleanupJobHandle: NodeJS.Timeout | undefined;
}

function startTokenCleanupJob() {
  if (globalThis.cleanupJobHandle) {
    console.warn("[Scheduler] Token 清理任务已运行");
    return;
  }

  const scheduleNextRun = () => {
    const now = new Date();
    const next = new Date();
    next.setHours(2, 0, 0, 0); // 凌晨 2:00

    // 如果今天 2:00 已过，则安排明天的 2:00
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    const delay = next.getTime() - now.getTime();

    globalThis.cleanupJobHandle = setTimeout(async () => {
      try {
        console.info("[Scheduler] 开始清理过期 Token 黑名单记录");
        const count = await cleanupExpiredTokens();
        console.info(`[Scheduler] Token 清理完成，共清理 ${count} 条过期记录`);
      } catch (err) {
        console.error("[Scheduler] Token 清理失败:", err);
      }

      // 安排下一次运行
      scheduleNextRun();
    }, delay);

    console.info(
      `[Scheduler] Token 清理任务已安排，下次运行时间: ${next.toISOString()}`,
    );
  };

  scheduleNextRun();
}

export function stopTokenCleanupJob() {
  if (globalThis.cleanupJobHandle) {
    clearTimeout(globalThis.cleanupJobHandle);
    globalThis.cleanupJobHandle = undefined;
    console.info("[Scheduler] Token 清理任务已停止");
  }
}
