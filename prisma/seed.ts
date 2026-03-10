/**
 * 数据库种子脚本
 * 运行：npx prisma db seed（或 npx tsx prisma/seed.ts）
 * 创建初始管理员账号
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// 显式加载 .env 文件
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
    // 优先从环境变量读取
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        console.error("❌ 错误: 未在 .env 中找到 ADMIN_EMAIL 或 ADMIN_PASSWORD");
        process.exit(1);
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    if (!existing) {
        const hash = await bcrypt.hash(password, 12);
        await prisma.user.create({
            data: {
                email,
                passwordHash: hash,
                role: "admin",
            },
        });
        console.log(`✓ 管理员账号已创建: ${email}`);
    } else {
        console.log(`ℹ 管理员账号已存在: ${email}，跳过创建`);
    }
}

main()
    .catch((e) => {
        console.error("种子脚本失败:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
