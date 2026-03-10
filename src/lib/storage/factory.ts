import { StorageProvider, StorageConfig } from "./types";
import { OpenListProvider } from "./providers/openlist";
import { decrypt, isEncrypted } from "../encryption";

/**
 * 存储提供商工厂
 * 获取具体提供商实例的统一点
 */
export function getStorageProvider(config: StorageConfig): StorageProvider {
    // 解密 token（如果已加密）
    const token = isEncrypted(config.token) ? decrypt(config.token) : config.token;
    
    // 考虑到现有架构对 AList/OpenList V3 的高度依赖，目前默认全部由 OpenListProvider 路由。
    // 后续增加 alist-v2, local-fs 或 s3 等实现时，在此处根据 config.type 进行 switch 即可实现解耦。
    return new OpenListProvider(config.host, token);
}
