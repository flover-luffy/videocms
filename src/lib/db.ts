import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// 开发环境防止热重载创建多个连接实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const connectionString = process.env.DATABASE_URL;

/**
 * 创建连接池配置
 * 优化数据库连接性能
 */
function createPoolConfig() {
  // 从环境变量读取连接池配置，使用合理的默认值
  const poolMinSize = parseInt(process.env.DATABASE_POOL_MIN || "5", 10);
  const poolMaxSize = parseInt(process.env.DATABASE_POOL_MAX || "20", 10);
  const idleTimeout = parseInt(
    process.env.DATABASE_POOL_IDLE_TIMEOUT || "900000",
    10,
  );
  const connectionTimeout = parseInt(
    process.env.DATABASE_POOL_CONNECTION_TIMEOUT || "30000",
    10,
  );

  return {
    min: poolMinSize,
    max: poolMaxSize,
    idleTimeoutMillis: idleTimeout,
    connectionTimeoutMillis: connectionTimeout,
    statement_timeout: 300000, // 5 分钟 SQL 执行超时
    application_name: "videocms",
  };
}

// 内部初始化函数
function createPrismaClient() {
  const poolConfig = createPoolConfig();

  // 创建连接池
  const pool = new Pool({
    connectionString,
    ...poolConfig,
  });
  globalForPrisma.pool = pool;

  // 监听连接池事件（用于调试和监控）
  pool.on("connect", () => {
    if (process.env.NODE_ENV === "development") {
      console.info("[DB Pool] 新连接建立");
    }
  });

  pool.on("error", (err) => {
    console.error("[DB Pool Error] 连接池异常:", err);
  });

  // Prisma 7 pg-adapter 类型定义尚未完全稳定
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter: adapter as never,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return Reflect.get(globalForPrisma.prisma, prop, receiver);
  },
});

/**
 * 获取连接池状态（用于监控）
 */
export function getPoolStats() {
  if (!globalForPrisma.pool) return null;
  return {
    totalCount: globalForPrisma.pool.totalCount,
    idleCount: globalForPrisma.pool.idleCount,
    waitingCount: globalForPrisma.pool.waitingCount,
  };
}

// 优雅关闭
process.on("beforeExit", async () => {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
  }
  if (globalForPrisma.pool) {
    await globalForPrisma.pool.end();
    globalForPrisma.pool = undefined;
  }
});
