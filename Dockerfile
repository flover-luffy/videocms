# ---------- 阶段 1：基础环境 ----------
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- 阶段 2：依赖安装 (deps) ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps --ignore-scripts

# ---------- 阶段 3：构建器 (builder) ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 关键：手动为构建阶段设置占位符环境变量，绕过 Prisma 静态校验
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/videocms"
ENV SKIP_ENV_VALIDATION=1

# 生成 Prisma Client 并构建应用
RUN npx prisma generate && npm run build

# ---------- 阶段 4：运行时 (runner) ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nextjs nextjs

WORKDIR /app

# 拷贝全量 standalone 产物
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

RUN install -d -o nextjs -g nodejs /app/.next/cache

# 运行时所需的 prisma CLI、tsx 以及配置文件解析依赖 (用于 seed 和 migrate)
# ws：一起看 WebSocket 服务器
RUN npm install prisma@7.5.0 tsx@4.21.0 ws@8.18.0

# 拷贝自定义启动脚本（集成 WebSocket 服务器）
COPY --from=builder --chown=nextjs:nodejs /app/start-server.mjs ./start-server.mjs

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 运行时真正的 DATABASE_URL 将由 docker-compose 提供
# 使用自定义启动脚本，同时启动 HTTP + WebSocket 服务
CMD ["node", "start-server.mjs"]
