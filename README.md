# VideoCMS

一个基于 Next.js 的视频内容管理系统,支持影视剧集和音乐专辑管理。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **数据库**: SQLite (Prisma ORM 7)
- **认证**: JWT
- **UI**: Tailwind CSS
- **视频播放**: Artplayer + HLS.js

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并配置:

```bash
cp .env.example .env
```

### 3. 初始化数据库

```bash
# 应用数据库迁移
npx prisma migrate deploy

# 创建管理员账号
npm run db:seed
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 默认管理员账号

- 邮箱: `admin@videocms.local`
- 密码: `admin123456`

## 可用脚本

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器
- `npm run db:seed` - 初始化数据库并创建管理员账号

## 功能特性

- 📺 影视剧集管理
- 🎵 音乐专辑管理
- 🔍 TMDB 元数据自动匹配
- 👤 用户认证与授权
- 📊 观看进度同步
- ⭐ 收藏功能
- 🎬 在线视频播放
- 🎨 响应式设计

## 项目结构

```
├── prisma/          # 数据库 schema 和迁移
├── public/          # 静态资源
├── scripts/         # 工具脚本
├── src/
│   ├── app/         # Next.js App Router 页面
│   ├── components/  # React 组件
│   ├── lib/         # 工具库和配置
│   ├── middleware/  # 中间件
│   ├── services/    # 业务逻辑服务
│   └── types/       # TypeScript 类型定义
└── ...
```

## License

MIT
