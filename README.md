# Rom's Cinema (基于 VideoCMS)

一个基于 Next.js 的现代化视频内容管理系统，致力于提供沉浸式的视听体验，支持影视剧集和音乐专辑管理。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **数据库**: PostgreSQL 15 (Prisma ORM 7)
- **认证**: JWT (无感刷新)
- **UI**: Tailwind CSS + Framer Motion (精细毛玻璃动效)
- **视频播放**: Artplayer Headless 架构 + HLS.js

## 快速开始 (本地开发)

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并配置参数。你需要一个本地或远程的 PostgreSQL 实例。

```bash
cp .env.example .env
```
_注：如未更改默认环境变量，本地需要运行于 5432 端口的 PostgreSQL，用户名密码和库名为环境变量中指定的值。_

### 3. 初始化数据库

```bash
# 生成并应用数据库初始化架构
npx prisma migrate dev --name init

# 生成 Prisma 客户端
npx prisma generate
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 生产部署 (Docker 微服务)

项目已内置针对生产环境优化的 Docker 化流程，应用服务与数据库层彻底解耦：

```bash
# 以后台微服务模式一键构建并启动 (包含 PostgreSQL 和 App)
docker compose up -d --build
```
数据与备份均通过 Docker Volumes 实现了持久化封装。

## 功能特性

- 📺 极简剧集与音乐专辑管理
- 🔍 TMDB 元数据自动匹配与高频演员全维度检索
- 👤 闭环用户认证与安全审计权限
- 📊 云端观看进度精确同步
- 🎬 全自定义 Artplayer 播放器（画中画、实时倍速、智能防遮挡字幕）
- 🌟 响应式设计（Mobile-first）及全局暗黑高质感美学

## 常见运维脚本 (位于 scripts/ 目录)

- `backup-db.sh` - 使用 `pg_dump` 对生产级 PostgreSQL 执行安全热备，支持定时任务与 S3 同步推送。

## License

MIT 协议。详情请查阅项目根目录下的 [LICENSE](LICENSE) 文件。
