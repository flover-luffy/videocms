import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { ENCRYPTION_CONFIG } from "@/config";
import { decrypt, encrypt, isEncrypted } from "./encryption";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const LEGACY_PBKDF2_ITERATIONS = 100_000;

function encryptWithLegacyIterations(plaintext: string): string {
  const key = crypto.pbkdf2Sync(
    ENCRYPTION_CONFIG.SECRET,
    ENCRYPTION_CONFIG.SALT,
    LEGACY_PBKDF2_ITERATIONS,
    KEY_LENGTH,
    "sha256",
  );
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`;
}

describe("Encryption Core Services", () => {
  it("should successfully encrypt and decrypt a plaintext string", () => {
    const plaintext = "super-secret-password-123!@#";
    const ciphertext = encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.split(":")).toHaveLength(6);
    expect(ciphertext.startsWith("v2:")).toBe(true);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("should decrypt ciphertext created with the legacy PBKDF2 settings", () => {
    const plaintext = "legacy-secret-token";
    const ciphertext = encryptWithLegacyIterations(plaintext);

    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("should correctly identify an encrypted string format", () => {
    const plaintext = "super-secret";
    const ciphertext = encrypt(plaintext);

    expect(isEncrypted(ciphertext)).toBe(true);
    expect(isEncrypted("v2:600000:abcd:1234:5678:90ab")).toBe(true);
    expect(isEncrypted("not-encrypted:bad-format")).toBe(false);
    expect(isEncrypted("just-plaintext")).toBe(false);
    expect(isEncrypted("abcd:1234:5678")).toBe(true);
  });

  it("should throw an error when trying to decrypt invalid data", () => {
    expect(() => decrypt("abcd:1234:5678")).toThrow();
  });
});
