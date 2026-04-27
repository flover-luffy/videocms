import { decodeProtectedHeader } from "jose";
import { describe, it, expect } from "vitest";
import { signAccessToken, verifyToken } from "./jwt";

describe("JWT Auth Utils", () => {
  const payload = { userId: 1, email: "test@example.com", role: "user" };

  it("should sign and verify a valid access token", async () => {
    const token = await signAccessToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(decodeProtectedHeader(token).alg).toBe("RS256");

    const verified = await verifyToken(token);
    expect(verified).toMatchObject({
      userId: 1,
      email: "test@example.com",
      role: "user",
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
