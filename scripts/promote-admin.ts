#!/usr/bin/env tsx
/**
 * Admin提升脚本
 * 用法: npm run promote-admin <userId>
 *
 * SECURITY: 此脚本应仅在服务器上由授权管理员运行
 * 永远不要通过API暴露admin提升功能
 */

import { prisma } from "../src/lib/db";

async function promoteToAdmin(userId: number) {
  try {
    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      console.error(`❌ 用户 ID ${userId} 不存在`);
      process.exit(1);
    }

    if (user.role === 'admin') {
      console.log(`✓ 用户 ${user.email} (ID: ${userId}) 已经是管理员`);
      process.exit(0);
    }

    // 更新用户角色
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'admin' },
    });

    // 审计日志
    console.log(`✅ 成功将用户提升为管理员:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log(`   Previous Role: ${user.role}`);
    console.log(`   New Role: admin`);

    process.exit(0);
  } catch (error) {
    console.error('❌ 提升管理员失败:', error);
    process.exit(1);
  }
}

// 获取命令行参数
const userIdArg = process.argv[2];

if (!userIdArg) {
  console.error('用法: npm run promote-admin <userId>');
  console.error('示例: npm run promote-admin 1');
  process.exit(1);
}

const userId = parseInt(userIdArg, 10);

if (!Number.isInteger(userId) || userId <= 0) {
  console.error('❌ 无效的用户ID，必须是正整数');
  process.exit(1);
}

promoteToAdmin(userId);
