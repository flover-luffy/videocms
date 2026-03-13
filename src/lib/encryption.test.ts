import { describe, it, expect } from "vitest";
import { encrypt, decrypt, isEncrypted } from "./encryption";

// 模拟配置环境以便于测试 (由于我们在 config/index.ts 中处理前置 fallback, 因此测试环境能安全跑通)

describe("Encryption Core Services", () => {
  it("should successfully encrypt and decrypt a plaintext string", () => {
    const plaintext = "super-secret-password-123!@#";
    
    // 加密
    const ciphertext = encrypt(plaintext);
    
    // 验证加密后不是明文
    expect(ciphertext).not.toBe(plaintext);
    // 验证加密后格式应包含两个冒号分号
    expect(ciphertext.split(":")).toHaveLength(3);
    
    // 解密
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it("should correctly identify an encrypted string format", () => {
    const plaintext = "super-secret";
    const ciphertext = encrypt(plaintext);
    
    expect(isEncrypted(ciphertext)).toBe(true);
    expect(isEncrypted("not-encrypted:bad-format")).toBe(false);
    expect(isEncrypted("just-plaintext")).toBe(false);
    expect(isEncrypted("abcd:1234:5678")).toBe(true); // 格式上符合
  });

  it("should throw an error when trying to decrypt invalid data", () => {
    const invalidCiphertext = "abcd:1234:5678"; // 捏造的十六进制
    
    expect(() => decrypt(invalidCiphertext)).toThrow();
  });
});
