import crypto from "crypto";
import { ENCRYPTION_CONFIG } from "@/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * 从统一配置派生加密密钥
 */
function getEncryptionKey(): Buffer {
    const { SECRET, SALT } = ENCRYPTION_CONFIG;
    // 使用 PBKDF2 派生固定长度密钥 (32 字节)
    return crypto.pbkdf2Sync(SECRET, SALT, 100000, KEY_LENGTH, "sha256");
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

export function decrypt(ciphertext: string): string {
    const key = getEncryptionKey();
    const parts = ciphertext.split(":");

    if (parts.length !== 3) {
        throw new Error("无效的加密数据格式");
    }

    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const tag = Buffer.from(parts[2], "hex");

    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (err: any) {
        console.error("[Encryption] 解密失败。可能原因：密钥不匹配、数据被篡改或环境变量已变更。", {
            error: err.message,
            ciphertextLength: ciphertext.length,
            keyHash: crypto.createHash('sha256').update(key).digest('hex').substring(0, 8)
        });
        
        if (err.message.includes("Unsupported state") || err.message.includes("authTag")) {
            throw new Error("数据解密认证失败：加密密钥不正确或数据已损坏。请尝试重新保存配置。");
        }
        throw err;
    }
}

/**
 * 检查字符串是否已加密
 */
export function isEncrypted(value: string): boolean {
    const parts = value.split(":");
    return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
}
