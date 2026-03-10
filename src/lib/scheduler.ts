declare global {
    var schedulerStarted: boolean | undefined;
    var importing: boolean | undefined;
    var importingTimeout: ReturnType<typeof setTimeout> | undefined;
}

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

