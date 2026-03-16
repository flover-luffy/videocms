# ============================================================
# VideoCMS 生产构建 — 重构版 Dockerfile
# 基于 Next.js standalone 输出模式
# ============================================================

# ---------- 阶段 1：基础环境 ----------
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- 阶段 2：安装生产依赖 (prod-deps) ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
# 仅安装生产环境必要的依赖
RUN npm ci --omit=dev

# ---------- 阶段 3：安装完整依赖并构建 (builder) ----------
FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/videocms"
ENV SKIP_ENV_VALIDATION=1

# 生成 Prisma Client 并构建应用 (standalone 模式)
RUN npx prisma generate && npm run build

# ---------- 阶段 4：运行时 (runner) ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 安全性：使用非 root 用户（必须指定 HOME 目录，否则 npx 无法写入缓存）
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nextjs nextjs

WORKDIR /app

# 1. 拷贝运行时 node_modules (来自 prod-deps)
COPY --from=prod-deps /app/node_modules ./node_modules

# 2. 拷贝构建产物 (standalone 模式已经包含了一个轻量的 node_modules，
# 但 Prisma Client 和 TSX 等需要我们在根目录额外保留的依赖依赖外部这个 node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 3. 拷贝运维文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

# 确保 nextjs 用户对应用目录有权
RUN chown -R nextjs:nodejs /app

USER nextjs
ENV HOME=/home/nextjs
ENV npm_config_cache=/home/nextjs/.npm

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
