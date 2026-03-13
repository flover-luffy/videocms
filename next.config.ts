import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Docker 部署必须：生成独立运行产物
  output: "standalone",
  // 必须开启，以便 Sentry SDK 自动上传 Source Maps 进行错误精准定位
  productionBrowserSourceMaps: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["localhost:3000"],
    },
  },
};

export default withSentryConfig(nextConfig, {
  // 保持构建输出清洁
  silent: true,
  org: "glitchtip", // 默认 org
  project: "videocms", // 对应 ID 为 21038
  sentryUrl: "https://app.glitchtip.com",
  // 上传更广泛的 Source Maps 以获得更漂亮的堆栈追踪（即便这会略微增加构建时间）
  widenClientFileUpload: true,
});
