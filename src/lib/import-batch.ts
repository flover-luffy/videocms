import { Prisma } from "@prisma/client";
import { prisma } from "./db";

type PrismaDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
};

export async function batchCheckExisting(
  model: unknown,
  uniqueField: string,
  where: Record<string, unknown>,
  pathField: string,
  paths: string[],
): Promise<Set<string>> {
  void uniqueField;

  if (paths.length === 0) {
    return new Set<string>();
  }

  const existing = await (model as PrismaDelegate).findMany({
    where: {
      ...where,
      [pathField]: { in: paths },
    },
    select: { [pathField]: true },
  });

  return new Set(existing.map((item) => String(item[pathField])));
}

export async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  config: { timeout?: number } = {},
): Promise<T> {
  const timeout = config.timeout ?? 300000;

  if (typeof prisma.$transaction !== "function") {
    return callback(prisma as unknown as Prisma.TransactionClient);
  }

  return prisma.$transaction(
    async (tx) => {
      if (process.env.DATABASE_STATEMENT_TIMEOUT && "$executeRaw" in tx) {
        const timeoutMs = Number.parseInt(
          process.env.DATABASE_STATEMENT_TIMEOUT,
          10,
        );

        if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
          await tx.$executeRaw`SET statement_timeout = ${timeoutMs}`;
        }
      }

      return callback(tx);
    },
    { timeout },
  );
}
