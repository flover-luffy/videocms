/**
 * 快速导入脚本
 * 用于测试 OpenList 连接并导入媒体数据
 */

const host = 'https://video.leenagyung.top';
const token = 'openlist-4ce14367-8993-4d68-b9d4-b2dd2cdd2b9coTjg25ESSuJpxA9QmuX08zoIynFSkDn66SjVxZuypoSmbRm2BMSk3l3RwZmO27ro';
const scanPath = '/video/Koreanfilm';

console.log('OpenList 配置信息:');
console.log(`Host: ${host}`);
console.log(`扫描路径: ${scanPath}`);
console.log(`Token: ${token.substring(0, 20)}...`);
console.log('\n开始测试连接...\n');

async function testConnection() {
    try {
        const response = await fetch(`${host}/api/fs/list`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({
                path: scanPath,
                password: '',
                page: 1,
                per_page: 10,
                refresh: false
            })
        });

        const data = await response.json();
        
        console.log('API 响应状态:', response.status);
        console.log('响应数据:', JSON.stringify(data, null, 2));
        
        if (data.code === 200) {
            console.log('\n✅ OpenList 连接成功！');
            console.log(`找到 ${data.data.content?.length || 0} 个文件/文件夹`);
            
            if (data.data.content && data.data.content.length > 0) {
                console.log('\n前 5 个项目:');
                data.data.content.slice(0, 5).forEach((item, idx) => {
                    console.log(`${idx + 1}. ${item.is_dir ? '[文件夹]' : '[文件]'} ${item.name}`);
                });
            }
            
            return true;
        } else {
            console.error('\n❌ OpenList 返回错误:');
            console.error(`错误代码: ${data.code}`);
            console.error(`错误信息: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error('\n❌ 连接失败:', error.message);
        return false;
    }
}

testConnection();
