# ============================================================
# VideoCMS 生产构建 — 多阶段 Dockerfile
# 基于 Next.js standalone 输出模式，最小化最终镜像体积
# ============================================================

# ---------- 阶段 1：依赖安装 ----------
FROM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- 阶段 2：构建 ----------
FROM node:22-slim AS builder

# 安装构建所需的依赖
RUN apt-get update && apt-get install -y openssl

# 全局安装 Prisma 以便后续阶段拷贝，规避运行时安装的网络不确定性
RUN npm install -g prisma@7.4.2 --unsafe-perm

WORKDIR /app

# 拷贝全部依赖（含 devDependencies，构建需要 TypeScript 等）
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码
COPY . .

# 规避 Next.js 和 Prisma 在静态解析阶段必须要有 DB 连接串以及触发连接尝试的问题
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/videocms?schema=public"
ENV SKIP_ENV_VALIDATION=1
ENV PRISMA_GENERATE_DATAPROXY=true

# 构建 Next.js（standalone 模式）
RUN npx prisma generate
RUN npm run build

# ---------- 阶段 3：运行时 ----------
FROM node:22-slim AS runner

# 安装运行时所需的最小依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安全性：使用非 root 用户运行
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 补全运行时 Seed 所需依赖（Next.js standalone 模式不包含这些额外驱动）
RUN npm install pg @prisma/adapter-pg bcryptjs dotenv --unsafe-perm

# 拷贝构建产物及依赖
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 确保 Prisma 命令行工具可用：直接从 builder 阶段拷贝全局安装的包
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=builder /usr/local/bin /usr/local/bin

# 拷贝 Prisma 相关配置（运行时 migrate 需要）
COPY --from=builder /app/prisma.config.js ./prisma.config.js
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/prisma/seed.ts ./prisma/seed.ts

# 拷贝运维脚本
COPY scripts ./scripts
RUN chmod +x scripts/*.sh 2>/dev/null || true

# 创建数据和备份目录
RUN mkdir -p prisma backups && \
    chown -R nextjs:nodejs prisma backups

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
