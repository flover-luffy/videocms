import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { CsrfProtection } from "./csrf-protection";

describe("CSRF Protection", () => {
    it("should allow GET requests without token", () => {
        const req = new NextRequest("http://localhost/api/test", { method: "GET" });
        const result = CsrfProtection.middleware(req);
        expect(result).toBeNull();
    });

    it("should block POST requests without token", () => {
        const req = new NextRequest("http://localhost/api/test", { method: "POST" });
        const result = CsrfProtection.middleware(req);
        expect(result).toBeDefined();
        expect(result?.status).toBe(403);
    });

    it("should allow POST with matching tokens", () => {
        const token = "test-token";
        const req = new NextRequest("http://localhost/api/test", {
            method: "POST",
            headers: {
                "x-xsrf-token": token,
                "cookie": `XSRF-TOKEN=${token}`
            }
        });
        const result = CsrfProtection.middleware(req);
        expect(result).toBeNull();
    });
});
