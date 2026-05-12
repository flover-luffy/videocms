# syntax=docker/dockerfile:1.7

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

ENV NEXT_TELEMETRY_DISABLED=1

# 构建必须通过 BuildKit secret 提供真实 .env，禁止使用任何占位配置。
RUN --mount=type=secret,id=app_env,target=/app/.env,required=true \
    npx prisma generate && npm run build

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

# 安装由于 standalone 无法自动 trace 的动态依赖，以及执行迁移用的 Prisma CLI
RUN npm install ws prisma@7.5.0 tsx --no-save

RUN install -d -o nextjs -g nodejs /app/.next/cache

# 拷贝自定义启动脚本（集成 WebSocket 服务器）
COPY --from=builder --chown=nextjs:nodejs /app/start-server.mjs ./start-server.mjs
# 拷贝 WebSocket 服务端源码及其依赖模块（standalone trace 不包含动态导入的文件）
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/ws-server.ts ./src/lib/ws-server.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/ws-protocol.ts ./src/lib/ws-protocol.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/auth/jwt.ts ./src/lib/auth/jwt.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db.ts ./src/lib/db.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/services/watch-room.service.ts ./src/services/watch-room.service.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/errors.ts ./src/lib/errors.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/config ./src/config
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 运行时真正的 DATABASE_URL 将由 docker-compose 提供
# 使用自定义启动脚本，同时启动 HTTP + WebSocket 服务
CMD ["node", "start-server.mjs"]
