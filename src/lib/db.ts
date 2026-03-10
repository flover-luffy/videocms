import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

// 开发环境防止热重载创建多个连接实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 获取数据库路径
const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "./prisma/dev.db";
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

console.log("[DB] 数据库路径:", `file:${resolvedPath}`);

// 创建 Prisma adapter factory
const adapter = new PrismaBetterSqlite3({
  url: resolvedPath,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// 优雅关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
