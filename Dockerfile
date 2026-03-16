# ============================================================
# VideoCMS 生产构建 — 重构版 Dockerfile
# 基于 Next.js standalone 输出模式
# ============================================================

# ---------- 阶段 1：基础环境 ----------
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- 阶段 2：依赖安装 ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 阶段 3：构建 ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/videocms"
ENV SKIP_ENV_VALIDATION=1

# 生成 Prisma Client 并构建应用
RUN npx prisma generate && npm run build

# ---------- 阶段 4：运行时 ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 安全性：使用非 root 用户（必须指定 HOME 目录，否则 npx 无法写入缓存）
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nextjs nextjs

# 拷贝构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 拷贝运行时运维所需文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# 在运行时阶段安装必要的生产驱动（因为 standalone 不包含 pg 等驱动）
RUN npm install pg @prisma/adapter-pg bcryptjs dotenv @prisma/client @prisma/config tsx prisma --unsafe-perm

# 确保 nextjs 用户对应用目录有写权限（prisma 迁移/seed 需要）
RUN chown -R nextjs:nodejs /home/nextjs

USER nextjs
ENV HOME=/home/nextjs
ENV npm_config_cache=/home/nextjs/.npm

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
