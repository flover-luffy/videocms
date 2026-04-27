/**
 * VideoCMS 自定义启动脚本
 *
 * 功能：
 * 1. 启动 Next.js standalone HTTP 服务器（node server.js 作为子进程）
 * 2. 在独立端口上启动一起看 WebSocket 服务器
 *
 * WebSocket 服务运行在 3010 端口，由 nginx 或前端代理 /ws/* 路径转发。
 * 如果不需要代理，前端也可以直接连接 3010 端口。
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WS_PORT = parseInt(process.env.WS_PORT || "3010", 10);

async function startServer() {
  // 1. 启动 Next.js standalone 服务（子进程）
  console.info("[StartServer] 启动 Next.js HTTP 服务...");
  const nextProcess = spawn("node", ["server.js"], {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  });

  nextProcess.on("error", (err) => {
    console.error("[StartServer] Next.js 进程启动失败:", err);
    process.exit(1);
  });

  nextProcess.on("exit", (code) => {
    console.error(`[StartServer] Next.js 进程退出，代码: ${code}`);
    process.exit(code ?? 1);
  });

  // 2. 启动 WebSocket 服务器
  try {
    const wsHttp = createServer((req, res) => {
      // WebSocket 升级请求会被 ws 库拦截，普通 HTTP 返回提示
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: "watch-room-ws", status: "running" }));
    });

    // 动态导入 ws-server（standalone 环境下路径可能不同）
    let initWatchRoomWS;
    try {
      const wsServerModule = await import("./src/lib/ws-server.ts");
      initWatchRoomWS = wsServerModule.initWatchRoomWS;
    } catch {
      // standalone 产物中 ts 文件可能已被编译
      try {
        const wsServerModule = await import("./ws-server.js");
        initWatchRoomWS = wsServerModule.initWatchRoomWS;
      } catch (e2) {
        console.warn(
          "[StartServer] 无法加载 ws-server 模块，一起看功能不可用:",
          e2.message,
        );
      }
    }

    if (typeof initWatchRoomWS === "function") {
      initWatchRoomWS(wsHttp);
      wsHttp.listen(WS_PORT, "0.0.0.0", () => {
        console.info(
          `[StartServer] ✅ 一起看 WebSocket 服务已启动: ws://0.0.0.0:${WS_PORT}/ws/watch-room`,
        );
      });
    } else {
      console.warn("[StartServer] initWatchRoomWS 不可用，跳过 WebSocket 启动");
    }
  } catch (err) {
    console.warn("[StartServer] WebSocket 服务启动失败（非致命）:", err.message);
  }

  // 优雅退出
  const shutdown = (signal) => {
    console.info(`[StartServer] 收到 ${signal}，正在关闭...`);
    nextProcess.kill(signal);
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
