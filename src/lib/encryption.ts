import crypto from "crypto";
import { ENCRYPTION_CONFIG } from "@/config";

const ALGORITHM = "aes-256-gcm";
const LEGACY_IV_LENGTH = 16;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const CURRENT_PBKDF2_ITERATIONS = 600_000;
const LEGACY_PBKDF2_ITERATIONS = [100_000];
const VERSION = "v2";
const HEX_REGEX = /^[0-9a-f]+$/i;
const AUTH_ERROR_HINTS = [
  "Unsupported state",
  "unable to authenticate data",
  "authTag",
];

function deriveKey(salt: Buffer, iterations: number): Buffer {
  return crypto.pbkdf2Sync(
    ENCRYPTION_CONFIG.SECRET,
    salt,
    iterations,
    KEY_LENGTH,
    "sha256",
  );
}

function decryptWithKey(
  iv: Buffer,
  encrypted: string,
  tag: Buffer,
  key: Buffer,
): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return AUTH_ERROR_HINTS.some((hint) => message.includes(hint));
}

function parseHexPart(value: string, expectedLength?: number): Buffer {
  if (!value || !HEX_REGEX.test(value)) {
    throw new Error("加密数据格式错误：非法的十六进制字符串");
  }

  const buffer = Buffer.from(value, "hex");
  if (expectedLength !== undefined && buffer.byteLength !== expectedLength) {
    throw new Error(`加密数据格式错误：预期长度 ${expectedLength} 字节，实际 ${buffer.byteLength} 字节`);
  }
  return buffer;
}

function decryptV2(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 6 || parts[0] !== VERSION) {
    throw new Error(`加密数据格式错误：预期 v2 格式（6 部分），实际 ${parts.length} 部分`);
  }

  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    throw new Error(`加密数据格式错误：迭代次数无效 (${parts[1]})`);
  }

  const salt = parseHexPart(parts[2], SALT_LENGTH);
  const iv = parseHexPart(parts[3], IV_LENGTH);
  const encrypted = parts[4];
  const tag = parseHexPart(parts[5], AUTH_TAG_LENGTH);

  return decryptWithKey(iv, encrypted, tag, deriveKey(salt, iterations));
}

function decryptLegacy(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error(`加密数据格式错误：预期旧版格式（3 部分），实际 ${parts.length} 部分`);
  }

  const [ivHex, encrypted, tagHex] = parts;
  const iv = parseHexPart(ivHex, LEGACY_IV_LENGTH);
  const tag = parseHexPart(tagHex, AUTH_TAG_LENGTH);
  const attemptedIterations = [
    CURRENT_PBKDF2_ITERATIONS,
    ...LEGACY_PBKDF2_ITERATIONS,
  ];
  
  // Try the current salt from env, and fallback salts used in previous versions
  // SECURITY: 移除硬编码的fallback salts以防止后门攻击
  // 如果需要解密旧数据，必须通过环境变量LEGACY_ENCRYPTION_SALTS提供
  const legacySalts = process.env.LEGACY_ENCRYPTION_SALTS
    ? process.env.LEGACY_ENCRYPTION_SALTS.split(',')
    : [];

  const attemptedSalts = [
    ENCRYPTION_CONFIG.SALT,
    ...legacySalts
  ];
  
  let lastError: unknown;

  for (const saltStr of attemptedSalts) {
    for (const iterations of attemptedIterations) {
      try {
        const key = deriveKey(Buffer.from(saltStr), iterations);
        return decryptWithKey(iv, encrypted, tag, key);
      } catch (error) {
        lastError = error;
        if (!isAuthError(error)) {
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  console.error(
    "[Encryption] Legacy decryption failed. Possible causes: key mismatch, tampered data, or changed environment variables.",
    {
      error: message,
      ciphertextLength: ciphertext.length,
      attemptedIterations,
      attemptedSalts
    },
  );

  throw new Error("数据解密认证失败：加密密钥不正确或数据已损坏。");
}

export function encrypt(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(salt, CURRENT_PBKDF2_ITERATIONS);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();
  return [
    VERSION,
    String(CURRENT_PBKDF2_ITERATIONS),
    salt.toString("hex"),
    iv.toString("hex"),
    encrypted,
    tag.toString("hex"),
  ].join(":");
}

export function decrypt(ciphertext: string): string {
  if (ciphertext.startsWith(`${VERSION}:`)) {
    return decryptV2(ciphertext);
  }
  return decryptLegacy(ciphertext);
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length === 6 && parts[0] === VERSION) {
    const [, iterations, salt, iv, encrypted, tag] = parts;
    return (
      /^\d+$/.test(iterations) &&
      [salt, iv, encrypted, tag].every((part) => HEX_REGEX.test(part))
    );
  }

  return parts.length === 3 && parts.every((part) => HEX_REGEX.test(part));
}
