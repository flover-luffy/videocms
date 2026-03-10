/**
 * 通过管理后台 API 更新 TMDB 元数据
 */

import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("❌ 请在 .env 文件中配置 ADMIN_EMAIL 和 ADMIN_PASSWORD");
    process.exit(1);
}

let accessToken = null;

async function login() {
    console.log('登录管理员账号...');
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });

    if (!response.ok) {
        throw new Error(`登录失败: ${response.status}`);
    }

    const data = await response.json();
    accessToken = data.accessToken;
    console.log('✅ 登录成功\n');
}

async function triggerEnrich() {
    console.log('触发元数据更新...\n');

    const response = await fetch(`${BASE_URL}/api/admin/enrich`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        }
    });

    console.log(`响应状态: ${response.status}`);

    if (!response.ok) {
        const error = await response.text();
        console.error(`❌ 更新失败: ${error}`);
        return false;
    }

    const data = await response.json();
    console.log('\n✅ 更新完成');
    console.log(`成功: ${data.success}`);
    console.log(`失败: ${data.failed}`);
    console.log(`跳过: ${data.skipped}`);

    if (data.errors && data.errors.length > 0) {
        console.log('\n错误详情:');
        data.errors.forEach(err => {
            console.log(`  - ${err}`);
        });
    }

    return true;
}

async function main() {
    try {
        console.log('='.repeat(70));
        console.log('通过 API 更新 TMDB 元数据');
        console.log('='.repeat(70));
        console.log();

        await login();
        await triggerEnrich();

        console.log();
        console.log('='.repeat(70));
        console.log('完成');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n❌ 失败:', error.message);
        process.exit(1);
    }
}

main();
