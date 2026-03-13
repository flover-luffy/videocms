
import { NextResponse } from "next/server";

const GLITCHTIP_DOMAIN = "app.glitchtip.com";
const PROJECT_ID = "21038";
const KEY = "18edceb3912f49408e096f5e731fe71b";

/**
 * GlitchTip Tunnel 路由 (App Router 版)
 * 用于绕过浏览器广告拦截器对监控流量的拦截
 */
export async function POST(req: Request) {
    try {
        const body = await req.text();
        // 参考官方指南拼接 Envelope 接口地址
        const url = `https://${GLITCHTIP_DOMAIN}/api/${PROJECT_ID}/envelope/?sentry_version=7&sentry_key=${KEY}&sentry_client=sentry.javascript.nextjs`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=UTF-8",
                "Accept": "*/*",
            },
            body: body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[GlitchTip Tunnel] Upstream error:", errorText);
            return NextResponse.json({ status: "error", message: "Failed to forward to GlitchTip" }, { status: response.status });
        }

        return NextResponse.json({ status: "ok" });
    } catch (error: any) {
        console.error("[GlitchTip Tunnel] Internal error:", error);
        return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
}
