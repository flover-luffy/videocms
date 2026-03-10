import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Docker 部署必须：生成独立运行产物
  output: "standalone",
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
      allowedOrigins: ["localhost:3000"],
    },
  },
};

// Sentry 插件配置
const sentryWebpackPluginOptions = {
  // 即使 Auth Token 缺失也允许构建通过（仅警告）
  silent: true,
  org: "luffy-wang",
  project: "javascript-nextjs",
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
