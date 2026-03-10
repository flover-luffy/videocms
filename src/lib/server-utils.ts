import { NextRequest } from "next/server";

/**
 * 获取客户端真实 IP 地址
 * 仅在服务端环境使用
 */
export function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");

    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }

    if (realIp) {
        return realIp.trim();
    }

    return "unknown";
}
