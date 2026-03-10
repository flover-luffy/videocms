/**
 * 设置管理员账号
 * 将指定用户提升为管理员角色
 */

import sqlite3 from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import 'dotenv/config';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("❌ 请在 .env 文件中配置 ADMIN_EMAIL 和 ADMIN_PASSWORD");
    process.exit(1);
}

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

async function setupAdmin() {
    console.log('设置管理员账号...\n');

    const db = sqlite3(dbPath);

    try {
        // 检查用户是否存在
        const user = db.prepare('SELECT * FROM User WHERE email = ?').get(ADMIN_EMAIL);

        if (user) {
            console.log(`✅ 找到用户: ${user.email}`);
            console.log(`   当前角色: ${user.role}`);

            if (user.role === 'admin') {
                console.log('   该用户已经是管理员\n');
            } else {
                // 提升为管理员
                db.prepare('UPDATE User SET role = ? WHERE email = ?').run('admin', ADMIN_EMAIL);
                console.log('   ✅ 已提升为管理员\n');
            }
        } else {
            console.log(`创建新的管理员账号: ${ADMIN_EMAIL}`);

            // 创建密码哈希
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(ADMIN_PASSWORD, salt);

            // 插入管理员用户
            const result = db.prepare(`
                INSERT INTO User (email, passwordHash, role, createdAt, updatedAt)
                VALUES (?, ?, 'admin', datetime('now'), datetime('now'))
            `).run(ADMIN_EMAIL, hash);

            console.log(`✅ 管理员账号创建成功，ID: ${result.lastInsertRowid}\n`);
        }

        // 显示所有管理员
        const admins = db.prepare('SELECT id, email, role FROM User WHERE role = ?').all('admin');
        console.log('当前所有管理员:');
        admins.forEach((admin, idx) => {
            console.log(`${idx + 1}. ${admin.email} (ID: ${admin.id})`);
        });

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

setupAdmin();
