import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAccessToken, verifyToken } from "./jwt";

// 模拟环境变量
vi.stubEnv("JWT_SECRET", "test-secret-key-at-least-32-chars-long");

describe("JWT Auth Utils", () => {
    const payload = { userId: 1, email: "test@example.com", role: "user" };

    it("should sign and verify a valid access token", async () => {
        const token = await signAccessToken(payload);
        expect(token).toBeDefined();
        expect(typeof token).toBe("string");

        const verified = await verifyToken(token);
        expect(verified).toMatchObject({
            userId: 1,
            email: "test@example.com",
            role: "user"
        });
    });

    it("should return null for an invalid token", async () => {
        const result = await verifyToken("invalid-token-string");
        expect(result).toBeNull();
    });

    it("should return null for an empty token", async () => {
        const result = await verifyToken("");
        expect(result).toBeNull();
    });
});
