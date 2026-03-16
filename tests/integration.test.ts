import { describe, it, expect, vi } from "vitest";
import { register } from "../src/instrumentation";
import { isBlacklisted, addToBlacklist } from "../src/lib/auth/token-blacklist";

describe("核心链路与安全机制集成测试 (O-5)", () => {
    describe("应用生命周期 (Instrumentation)", () => {
        it("如果是 nodejs runtime，应自动拉起内部定时器与监控端点", async () => {
            // 劫持并模拟 Nodejs 运行时环境变量
            const originalRuntime = process.env.NEXT_RUNTIME;
            process.env.NEXT_RUNTIME = "nodejs";

            // 拦截对 startScheduler 的动态导入
            const startSchedulerMock = vi.fn();
            vi.doMock("@/lib/scheduler", () => ({
                startScheduler: startSchedulerMock
            }));

            await register();

            // 由于 register 有多条支路（含 OTLP 测）且不便深度拦截 OTEL，所以主要断言 scheduler 被调用
            // 注：此处因为 async import 会在全局上下文，可能产生时序问题。这只是骨架示例。
            expect(startSchedulerMock).toHaveBeenCalled();

            process.env.NEXT_RUNTIME = originalRuntime;
        });
    });

    describe("安全护城河 (JWT Cache)", () => {
        it("黑名单拦截：被强制登出的凭证永远无法验证", async () => {
            const fakeToken = "ey.......suspect-token";
            
            // 写入黑名单（背后使用的是 CacheManager 和潜在的 Redis/LRUCache）
            // isBlacklisted 和 addToBlacklist 期望的是 string 类型的 token/jti，及其过期时间戳（字符串）
            await addToBlacklist(fakeToken, "9999999999");
            
            // 验证黑名单系统对其拦截的定性判断
            const isBlocked = await isBlacklisted(fakeToken);
            expect(isBlocked).toBe(true);
        });
    });
});
