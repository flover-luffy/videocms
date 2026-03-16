import type { NextConfig } from "next";

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
      allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["localhost:3000"],
    },
  },
  async headers() {
    return [
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
    ];
  },

};

export default nextConfig;
