import crypto from "crypto";
import { ENCRYPTION_CONFIG } from "@/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const CURRENT_PBKDF2_ITERATIONS = 600_000;
const LEGACY_PBKDF2_ITERATIONS = [100_000];
const AUTH_ERROR_HINTS = [
  "Unsupported state",
  "unable to authenticate data",
  "authTag",
];

const derivedKeyCache = new Map<number, Buffer>();

function getEncryptionKey(iterations = CURRENT_PBKDF2_ITERATIONS): Buffer {
  const cachedKey = derivedKeyCache.get(iterations);
  if (cachedKey) {
    return cachedKey;
  }

  const { SECRET, SALT } = ENCRYPTION_CONFIG;
  const key = crypto.pbkdf2Sync(SECRET, SALT, iterations, KEY_LENGTH, "sha256");
  derivedKeyCache.set(iterations, key);
  return key;
}

function parseCiphertext(ciphertext: string) {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("无效的加密数据格式");
  }

  const [ivHex, encrypted, tagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  if (iv.byteLength !== IV_LENGTH || tag.byteLength !== 16) {
    throw new Error("无效的加密数据格式");
  }

  return { iv, encrypted, tag };
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

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const { iv, encrypted, tag } = parseCiphertext(ciphertext);
  const attemptedIterations = [
    CURRENT_PBKDF2_ITERATIONS,
    ...LEGACY_PBKDF2_ITERATIONS,
  ];
  let lastError: unknown;

  for (const iterations of attemptedIterations) {
    try {
      return decryptWithKey(iv, encrypted, tag, getEncryptionKey(iterations));
    } catch (error) {
      lastError = error;
      if (!isAuthError(error)) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  console.error(
    "[Encryption] Decryption failed. Possible causes: key mismatch, tampered data, or changed environment variables.",
    {
      error: message,
      ciphertextLength: ciphertext.length,
      attemptedIterations,
    },
  );

  throw new Error(
    "数据解密认证失败：加密密钥不正确或数据已损坏。请尝试重新保存配置。",
  );
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((part) => /^[0-9a-f]+$/i.test(part));
}
