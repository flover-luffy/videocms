import { PrismaClient } from "@prisma/client";
import { encrypt, isEncrypted } from "../src/lib/encryption";

const prisma = new PrismaClient();

async function migrateTokens() {
    console.log("[Migration] 开始加密现有 OpenList Token...");
    
    const configs = await prisma.openlistConfig.findMany();
    
    if (configs.length === 0) {
        console.log("[Migration] 没有找到需要迁移的配置");
        return;
    }
    
    let encryptedCount = 0;
    let skippedCount = 0;
    
    for (const config of configs) {
        // 检查是否已加密
        if (isEncrypted(config.token)) {
            console.log(`[Migration] 配置 ${config.id} (${config.name}) 已加密，跳过`);
            skippedCount++;
            continue;
        }
        
        try {
            const encryptedToken = encrypt(config.token);
            await prisma.openlistConfig.update({
                where: { id: config.id },
                data: { token: encryptedToken }
            });
            
            console.log(`[Migration] 配置 ${config.id} (${config.name}) 已加密`);
            encryptedCount++;
        } catch (err) {
            console.error(`[Migration] 配置 ${config.id} 加密失败:`, err);
        }
    }
    
    console.log(`[Migration] 完成！加密: ${encryptedCount}, 跳过: ${skippedCount}`);
}

migrateTokens()
    .catch((err) => {
        console.error("[Migration] 迁移失败:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
