import type { NextConfig } from "next";

const allowedOrigins = (
  process.env.API_ALLOWED_ORIGINS ||
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const primaryAllowedOrigin = allowedOrigins[0] || "http://localhost:3000";

const nextConfig: NextConfig = {
  // 生产环境绝对禁止忽略类型报错
  typescript: { ignoreBuildErrors: false },
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
      allowedOrigins,
    },
  },
  async headers() {
    const headers = [
      {
        // 播放页面：启用 Cross-Origin-Isolated，使 SharedArrayBuffer 可用。
        // COEP credentialless（Chrome 96+）比 require-corp 更宽松：
        // 不要求第三方资源（如 AList 视频流）携带 CORP 头。
        source: "/play/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      {
        // API 路由的 CORS 和缓存头
        source: "/api/:path*",
        headers: [
          // CORS 头
          {
            key: "Access-Control-Allow-Origin",
            value: primaryAllowedOrigin,
          },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, PATCH, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, Idempotency-Key" },
          { key: "Access-Control-Max-Age", value: "86400" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
      {
        // 静态资源的长期缓存
        source: "/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // 图片的缓存策略
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        // 媒体库的缓存策略
        source: "/library/:path*",
        headers: [
          { key: "Cache-Control", value: "private, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        // 搜索结果的短期缓存
        source: "/search/:path*",
        headers: [
          { key: "Cache-Control", value: "private, max-age=300" },
        ],
      },
    ];

    return headers;
  },

};

export default nextConfig;
