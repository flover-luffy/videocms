/**
 * Prisma 7 配置文件 (JS 版)
 */
module.exports = {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/videocms",
  },
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.ts",
  }
};