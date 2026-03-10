import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * 从环境变量派生加密密钥
 */
function getEncryptionKey(): Buffer {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("🚨 [FATAL] 生产环境中未设置 ENCRYPTION_SECRET!");
        }
        console.warn("⚠️ [SECURITY] 未设置 ENCRYPTION_SECRET，使用开发环境默认密钥");
        return crypto.pbkdf2Sync("dev-secret-do-not-use-in-production", "salt", 100000, KEY_LENGTH, "sha256");
    }

    // 使用 PBKDF2 派生固定长度密钥
    return crypto.pbkdf2Sync(secret, "videocms-salt", 100000, KEY_LENGTH, "sha256");
}

/**
 * 加密敏感数据
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    // 格式: iv:encrypted:tag
    return `${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`;
}

/**
 * 解密敏感数据
 */
export function decrypt(ciphertext: string): string {
    const key = getEncryptionKey();
    const parts = ciphertext.split(":");

    if (parts.length !== 3) {
        throw new Error("无效的加密数据格式");
    }

    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const tag = Buffer.from(parts[2], "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

/**
 * 检查字符串是否已加密
 */
export function isEncrypted(value: string): boolean {
    const parts = value.split(":");
    return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
}
