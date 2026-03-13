import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface HealthCheck {
    status: "healthy" | "unhealthy";
    timestamp: string;
    checks: {
        database: { status: "up" | "down"; latency?: number };
        memory: { status: "ok" | "warning"; usage: number; limit: number };
    };
}

/**
 * 健康检查端点
 * GET /api/health
 */
export async function GET() {
    const checks: HealthCheck["checks"] = {
        database: { status: "down" },
        memory: { status: "ok", usage: 0, limit: 0 },
    };

    // 检查数据库连接
    try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        checks.database = {
            status: "up",
            latency: Date.now() - dbStart,
        };
    } catch (err) {
        console.error("[Health] 数据库检查失败:", err);
        checks.database = { status: "down" };
    }

    // 检查内存使用
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed / 1024 / 1024; // MB
    const heapTotal = memUsage.heapTotal / 1024 / 1024; // MB
    const rss = memUsage.rss / 1024 / 1024; // MB
    
    // 只有当 heapUsed 接近 heapTotal 且 RSS 已经很大时才报 warning
    // 或者简单化：内存 warning 不应直接导致 503，除非数据库挂了
    checks.memory = {
        status: heapUsed / heapTotal > 0.95 ? "warning" : "ok",
        usage: Math.round(heapUsed),
        limit: Math.round(heapTotal),
    };

    const overallStatus = checks.database.status === "up" ? "healthy" : "unhealthy";

    const response: HealthCheck = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
    };

    const statusCode = overallStatus === "healthy" ? 200 : 503;
    return NextResponse.json(response, { status: statusCode });
}
