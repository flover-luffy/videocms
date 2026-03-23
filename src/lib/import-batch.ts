type PrismaDelegate = {
  findMany?: (...args: unknown[]) => unknown;
  createMany?: (...args: unknown[]) => unknown;
  update?: (...args: unknown[]) => unknown;
};
/**
 * 批量导入优化工具库
 * 用于高效批量处理媒体导入操作
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./db";

interface BatchImportConfig {
  /** 每个批次的大小（默认 100） */
  batchSize?: number;
  /** 是否使用事务（推荐 true） */
  useTransaction?: boolean;
  /** 是否跳过重复项 */
  skipDuplicates?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 分批执行操作，防止内存溢出和数据库连接瓶颈
 * @example
 * const items = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
 * await batchProcess(items, async (batch) => {
 *   await prisma.model.createMany({ data: batch });
 * }, { batchSize: 500 });
 */
export async function batchProcess<T>(
  items: T[],
  processor: (batch: T[]) => Promise<void>,
  config: BatchImportConfig = {},
) {
  const batchSize = config.batchSize ?? 100;
  const timeout = config.timeout ?? 300000; // 5分钟超时

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, Math.min(i + batchSize, items.length));

    try {
      await Promise.race([
        processor(batch),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("批处理超时")), timeout),
        ),
      ]);
    } catch (err) {
      console.error(
        `[BatchProcess] 批次 ${Math.floor(i / batchSize) + 1} 失败:`,
        err,
      );
      throw err;
    }
  }
}

/**
 * 批量查询现存记录（防止 N+1 查询）
 * @example
 * const existing = await batchCheckExisting<Episode>(
 *   prisma.episode,
 *   "seriesId",
 *   { seriesId: 1 },
 *   "openlistPath",
 *   pathsList
 * );
 */
export async function batchCheckExisting(
  model: PrismaDelegate,
  uniqueField: string,
  where: Record<string, unknown>,
  pathField: string,
  paths: string[],
) {
  if (paths.length === 0) return new Set<string>();

  const existing = await model.findMany({
    where: {
      ...where,
      [pathField]: { in: paths },
    },
    select: { [pathField]: true },
  });

  return new Set(
    existing.map((item: Record<string, unknown>) => item[pathField]),
  );
}

/**
 * 批量创建带有去重的记录
 * @example
 * await batchCreateUnique(
 *   prisma.episode,
 *   episodesToCreate,
 *   ['seriesId', 'openlistPath']
 * );
 */
export async function batchCreateUnique<T extends Record<string, unknown>>(
  model: PrismaDelegate,
  data: T[],
  config: BatchImportConfig & { uniqueFields?: string[] } = {},
) {
  const batchSize = config.batchSize ?? 100;
  const skipDuplicates = config.skipDuplicates ?? true;

  if (data.length === 0) return { count: 0 };

  let totalCreated = 0;

  await batchProcess(
    data,
    async (batch) => {
      const result = await model.createMany({
        data: batch,
        skipDuplicates,
      });
      totalCreated += result.count;
    },
    { batchSize },
  );

  return { count: totalCreated };
}

/**
 * 批量更新记录
 * @example
 * await batchUpdate(
 *   prisma.series,
 *   updates,
 *   'id'
 * );
 */
export async function batchUpdate<T extends Record<string, unknown>>(
  model: PrismaDelegate,
  updates: T[],
  idField: string = "id",
  config: BatchImportConfig = {},
) {
  const batchSize = config.batchSize ?? 100;
  let totalUpdated = 0;

  await batchProcess(
    updates,
    async (batch) => {
      for (const update of batch) {
        const id = update[idField];
        const data: Record<string, unknown> = { ...update };
        delete data[idField];

        try {
          await model.update({
            where: { [idField]: id },
            data,
          });
          totalUpdated++;
        } catch (err) {
          console.warn(`[BatchUpdate] 更新 ${idField}=${id} 失败:`, err);
        }
      }
    },
    { batchSize },
  );

  return { count: totalUpdated };
}

/**
 * 并行执行多个批量操作（使用连接池高效）
 * @example
 * await parallelBatchOps([
 *   { model: prisma.episode, data: episodes, config: {} },
 *   { model: prisma.track, data: tracks, config: {} },
 * ]);
 */
export async function parallelBatchOps(
  operations: Array<{
    model: PrismaDelegate;
    data: Record<string, unknown>[];
    config?: BatchImportConfig;
  }>,
) {
  const results = await Promise.all(
    operations.map(async (op) => {
      try {
        return await batchCreateUnique(op.model, op.data, op.config);
      } catch (err) {
        console.error("[ParallelBatchOps] 操作失败:", err);
        return { count: 0, error: err };
      }
    }),
  );

  return {
    totalCreated: results.reduce((sum, r) => sum + (r.count ?? 0), 0),
    results,
  };
}

/**
 * 事务包装器（确保批量操作的原子性）
 * @example
 * const result = await withTransaction(async (tx) => {
 *   await tx.episode.createMany({ data: episodes });
 *   await tx.series.update({ where: {id}, data });
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  config: { timeout?: number } = {},
): Promise<T> {
  const timeout = config.timeout ?? 300000; // 5分钟

  if (typeof prisma.$transaction !== "function") {
    return callback(prisma as unknown as Prisma.TransactionClient);
  }

  return prisma.$transaction(
    async (tx) => {
      // 设置查询超时
      if (process.env.DATABASE_STATEMENT_TIMEOUT && "$executeRawUnsafe" in tx) {
        await tx.$executeRawUnsafe(
          `SET statement_timeout = ${process.env.DATABASE_STATEMENT_TIMEOUT}`,
        );
      }
      return await callback(tx);
    },
    {
      timeout,
    },
  );
}

/**
 * 批量导入摘要统计
 */
export interface ImportBatchSummary {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  duration: number; // 毫秒
  performanceMetrics?: {
    itemsPerSecond: number;
    averageItemTime: number; // 毫秒
  };
}

/**
 * 监控批量导入性能
 * @example
 * const summary = await monitorBatchImport(async () => {
 *   await batchProcess(items, processor);
 * }, items.length);
 */
export async function monitorBatchImport(
  operation: () => Promise<void>,
  totalItems: number,
): Promise<ImportBatchSummary> {
  const startTime = Date.now();

  try {
    await operation();
    const duration = Date.now() - startTime;

    return {
      totalProcessed: totalItems,
      successCount: totalItems,
      errorCount: 0,
      duration,
      performanceMetrics: {
        itemsPerSecond: (totalItems / duration) * 1000,
        averageItemTime: duration / totalItems,
      },
    };
  } catch {
    const duration = Date.now() - startTime;
    return {
      totalProcessed: totalItems,
      successCount: 0,
      errorCount: totalItems,
      duration,
    };
  }
}
