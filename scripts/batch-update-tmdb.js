/**
 * 批量更新所有剧集的 TMDB 元数据
 * 支持断点续传：中途中断后重新运行可自动跳过已完成的剧集
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = path.join(__dirname, '.batch-progress.json');

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("❌ 请在 .env 文件中配置 ADMIN_EMAIL 和 ADMIN_PASSWORD");
    process.exit(1);
}

let accessToken = null;

// ========== 进度管理 ==========

/**
 * 加载上次执行的进度
 * @returns {{ completedIds: string[], startedAt: string }}
 */
function loadProgress() {
    try {
        const raw = fs.readFileSync(PROGRESS_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return { completedIds: [], startedAt: new Date().toISOString() };
    }
}

/**
 * 持久化当前进度到磁盘
 * @param {{ completedIds: string[], startedAt: string }} progress
 */
function saveProgress(progress) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/** 清除进度文件（全部完成后调用） */
function clearProgress() {
    try { fs.unlinkSync(PROGRESS_FILE); } catch { /* 忽略 */ }
}

// ========== API 调用 ==========

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

async function getAllSeries() {
    console.log('获取所有剧集...');
    const response = await fetch(`${BASE_URL}/api/series?page=1&limit=100`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        throw new Error(`获取剧集失败: ${response.status}`);
    }

    const data = await response.json();
    console.log(`找到 ${data.items.length} 个剧集\n`);
    return data.items;
}

async function enrichSeries(seriesId) {
    const response = await fetch(`${BASE_URL}/api/admin/enrich`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ seriesId })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }

    return await response.json();
}

// ========== 主流程 ==========

async function main() {
    try {
        console.log('='.repeat(70));
        console.log('批量更新 TMDB 元数据（支持断点续传）');
        console.log('='.repeat(70));
        console.log();

        await login();
        const series = await getAllSeries();
        const progress = loadProgress();

        const completedSet = new Set(progress.completedIds);
        const pendingSeries = series.filter(s => !completedSet.has(s.id));

        if (pendingSeries.length < series.length) {
            const skippedCount = series.length - pendingSeries.length;
            console.log(`⏭️  跳过 ${skippedCount} 个已完成的剧集（断点续传）\n`);
        }

        let successCount = 0;
        let failCount = 0;
        const skippedCount = completedSet.size;

        for (const s of pendingSeries) {
            console.log(`处理: ${s.title} (ID: ${s.id})`);

            try {
                const result = await enrichSeries(s.id);
                console.log(`  ✅ 更新成功`);
                if (result.updated) {
                    console.log(`     评分: ${result.updated.voteAverage}`);
                    console.log(`     年份: ${result.updated.year}`);
                }
                successCount++;
            } catch (error) {
                console.log(`  ❌ 更新失败: ${error.message}`);
                failCount++;
            }

            // 无论成功失败都记录进度，避免重复处理
            progress.completedIds.push(s.id);
            saveProgress(progress);

            console.log();

            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('='.repeat(70));
        console.log('更新完成');
        console.log('='.repeat(70));
        console.log(`成功: ${successCount}`);
        console.log(`失败: ${failCount}`);
        console.log(`跳过（已完成）: ${skippedCount}`);
        console.log(`总计: ${series.length}`);

        // 全部完成后清除进度文件
        if (failCount === 0) {
            clearProgress();
            console.log('\n🧹 进度文件已清除（全部成功）');
        } else {
            console.log(`\n⚠️  有 ${failCount} 个失败项，进度已保存，重新运行可跳过已完成项`);
        }

    } catch (error) {
        console.error('\n❌ 失败:', error.message);
        process.exit(1);
    }
}

main();
