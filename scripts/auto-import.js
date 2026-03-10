/**
 * 自动导入脚本
 * 1. 创建 OpenList 配置
 * 2. 导入媒体数据
 */

const ADMIN_EMAIL = 'romsae@foxmail.com';
const ADMIN_PASSWORD = '123.abc456*ABC';
const BASE_URL = 'http://localhost:3000';

const OPENLIST_CONFIG = {
    name: '韩剧资源库',
    host: 'https://video.leenagyung.top',
    token: 'openlist-4ce14367-8993-4d68-b9d4-b2dd2cdd2b9coTjg25ESSuJpxA9QmuX08zoIynFSkDn66SjVxZuypoSmbRm2BMSk3l3RwZmO27ro',
    scanPath: '/video/Koreanfilm'
};

let accessToken = null;

async function register() {
    console.log('📝 注册管理员账号...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                username: 'Admin'
            })
        });

        if (response.ok) {
            console.log('✅ 注册成功\n');
            return true;
        } else if (response.status === 400) {
            const error = await response.json();
            if (error.error && error.error.includes('已存在')) {
                console.log('ℹ️  账号已存在，跳过注册\n');
                return true;
            }
        }
        
        const error = await response.text();
        console.log(`⚠️  注册失败: ${error}\n`);
        return false;
    } catch (error) {
        console.log(`⚠️  注册失败: ${error.message}\n`);
        return false;
    }
}

async function login() {
    console.log('🔐 登录管理员账号...');
    
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`登录失败: ${response.status} ${error}`);
    }

    const data = await response.json();
    accessToken = data.accessToken;
    
    console.log('✅ 登录成功\n');
    return accessToken;
}

async function createConfig() {
    console.log('📝 创建 OpenList 配置...');
    console.log(`   名称: ${OPENLIST_CONFIG.name}`);
    console.log(`   Host: ${OPENLIST_CONFIG.host}`);
    console.log(`   扫描路径: ${OPENLIST_CONFIG.scanPath}\n`);
    
    const response = await fetch(`${BASE_URL}/api/admin/configs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            name: OPENLIST_CONFIG.name,
            host: OPENLIST_CONFIG.host,
            token: OPENLIST_CONFIG.token
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`创建配置失败: ${response.status} ${error}`);
    }

    const data = await response.json();
    console.log(`✅ 配置创建成功，ID: ${data.id}\n`);
    return data.id;
}

async function importMedia(configId) {
    console.log('📥 开始导入媒体数据...');
    console.log('   这可能需要几分钟时间，请耐心等待...\n');
    
    const response = await fetch(`${BASE_URL}/api/admin/import`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            configId: configId,
            path: OPENLIST_CONFIG.scanPath  // 修正：使用 path 而不是 scanPath
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`导入失败: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    console.log('✅ 导入完成！\n');
    console.log('📊 导入统计:');
    console.log(`   新增剧集: ${data.seriesCreated || 0}`);
    console.log(`   新增集数: ${data.episodesCreated || 0}`);
    console.log(`   更新剧集: ${data.seriesUpdated || 0}`);
    console.log(`   更新集数: ${data.episodesUpdated || 0}`);
    console.log(`   跳过文件: ${data.skipped || 0}`);
    
    console.log('\n完整响应:', JSON.stringify(data, null, 2));
    
    return data;
}

async function main() {
    try {
        console.log('='.repeat(60));
        console.log('VideoCMS 自动导入脚本');
        console.log('='.repeat(60));
        console.log();
        
        // 0. 注册（如果需要）
        await register();
        
        // 1. 登录
        await login();
        
        // 2. 创建配置
        const configId = await createConfig();
        
        // 3. 导入媒体
        await importMedia(configId);
        
        console.log();
        console.log('='.repeat(60));
        console.log('🎉 所有操作完成！');
        console.log('='.repeat(60));
        console.log();
        console.log('现在您可以:');
        console.log('1. 访问 http://localhost:3000 查看媒体列表');
        console.log('2. 点击任意剧集开始播放');
        console.log();
        
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        console.error('\n请检查:');
        console.error('1. 服务器是否正在运行 (npm run dev)');
        console.error('2. 管理员账号密码是否正确');
        console.error('3. OpenList 配置是否正确');
        process.exit(1);
    }
}

main();
