import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// 开发环境防止热重载创建多个连接实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

// 内部初始化函数
function createPrismaClient() {
  const pool = new Pool({ connectionString });
  // @ts-ignore
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter: adapter as any,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return Reflect.get(globalForPrisma.prisma, prop, receiver);
  }
});

// 优雅关闭
process.on('beforeExit', async () => {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
  }
});

