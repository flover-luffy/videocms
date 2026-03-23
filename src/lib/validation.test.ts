import { describe, it, expect } from "vitest";
import { RegisterSchema, LoginSchema } from "./validation";

describe("Validation Schemas", () => {
  describe("LoginSchema", () => {
    it("should validate a correct email and simple password", () => {
      // 验证我们刚刚修复的 Bug: LoginSchema 应该能接受历史弱密码进行登录校验，而不是在 Zod 层拦截
      const result = LoginSchema.safeParse({
        email: "test@example.com",
        password: "short", // 即使密码很弱也应该能过 Schema (为了兼容历史账号登录)
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid emails", () => {
      const result = LoginSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("无效的邮箱格式");
      }
    });

    it("should reject empty passwords", () => {
      const result = LoginSchema.safeParse({
        email: "test@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("密码不能为空");
      }
    });
  });

  describe("RegisterSchema", () => {
    it("should reject weak passwords", () => {
      const result = RegisterSchema.safeParse({
        email: "test@test.com",
        code: "123456",
        password: "weakpassword", // 缺少大写、数字、特殊符号，且可能不够长
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing auth code", () => {
      const result = RegisterSchema.safeParse({
        email: "test@test.com",
        password: "StrongPassword123!",
      }); // 缺少 code
      expect(result.success).toBe(false);
    });

    it("should validate a correct registration payload", () => {
      const result = RegisterSchema.safeParse({
        email: "newuser@example.com",
        code: "654321",
        password: "SuperSecurePassword123#",
      });
      expect(result.success).toBe(true);
    });
  });
});
