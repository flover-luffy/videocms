/**
 * 手动更新 TMDB 元数据
 */

import sqlite3 from 'better-sqlite3';
import path from 'path';
import 'dotenv/config';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
    console.error("❌ 请在 .env 文件中配置 TMDB_API_KEY");
    process.exit(1);
}
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

async function searchTmdb(title) {
    const url = `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&language=zh-CN&query=${encodeURIComponent(title)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const candidates = data.results
            .filter(r => r.media_type !== 'person' && r.vote_count > 0)
            .sort((a, b) => b.vote_count - a.vote_count);

        if (candidates.length === 0) return null;

        const best = candidates[0];
        const isMovie = best.media_type === 'movie';

        // 获取详情
        const detailUrl = `${TMDB_BASE}/${isMovie ? 'movie' : 'tv'}/${best.id}?api_key=${TMDB_API_KEY}&language=zh-CN&append_to_response=credits`;
        const detailResponse = await fetch(detailUrl);
        const detail = await detailResponse.json();

        const rawDate = isMovie ? detail.release_date : detail.first_air_date;
        const year = rawDate ? new Date(rawDate).getFullYear() : null;

        // 提取导演/制片人
        let director = '';
        let cast = [];

        if (detail.credits) {
            if (isMovie) {
                const dirObj = detail.credits.crew?.find(c => c.job === 'Director');
                if (dirObj) director = dirObj.name;
            } else {
                const creatorObj = detail.created_by?.[0] || detail.credits.crew?.find(c => c.job === 'Executive Producer' || c.job === 'Producer');
                if (creatorObj) director = creatorObj.name;
            }

            cast = (detail.credits.cast || []).slice(0, 5).map(c => c.name);
        }

        const genres = (detail.genres || []).map(g => {
            const zhMap = {
                "Action": "动作", "Adventure": "冒险", "Animation": "动画", "Comedy": "喜剧",
                "Crime": "犯罪", "Documentary": "纪录片", "Drama": "剧情", "Family": "家庭",
                "Fantasy": "奇幻", "History": "历史", "Horror": "恐怖", "Music": "音乐",
                "Mystery": "悬疑", "Romance": "爱情", "Science Fiction": "科幻",
                "Thriller": "惊悚", "War": "战争", "Western": "西部",
                "Action & Adventure": "动作冒险", "Kids": "儿童", "News": "新闻",
                "Reality": "真人秀", "Sci-Fi & Fantasy": "科幻奇幻", "Soap": "肥皂剧",
                "Talk": "脱口秀", "War & Politics": "战争政治"
            };
            return zhMap[g.name] || g.name;
        });

        return {
            tmdbId: detail.id,
            title: (isMovie ? detail.title : detail.name) || title,
            type: isMovie ? 'movie' : 'tv',
            posterUrl: detail.poster_path ? `${TMDB_IMAGE_BASE}${detail.poster_path}` : null,
            backdropUrl: detail.backdrop_path ? `https://image.tmdb.org/t/p/original${detail.backdrop_path}` : null,
            overview: detail.overview || '',
            voteAverage: Math.round((detail.vote_average || 0) * 10) / 10,
            year: isNaN(year) ? null : year,
            genres: JSON.stringify(genres),
            cast: cast.length > 0 ? JSON.stringify(cast) : null,
            director: director || null,
            tmdbData: JSON.stringify(detail)
        };
    } catch (error) {
        console.error(`  ❌ 搜索失败: ${error.message}`);
        return null;
    }
}

async function updateAllMetadata() {
    console.log('='.repeat(70));
    console.log('更新所有剧集的 TMDB 元数据');
    console.log('='.repeat(70));
    console.log();

    const db = sqlite3(dbPath);

    try {
        const series = db.prepare('SELECT id, title FROM Series WHERE tmdbId IS NULL').all();

        console.log(`找到 ${series.length} 个需要更新的剧集\n`);

        let successCount = 0;
        let failCount = 0;

        for (const s of series) {
            console.log(`处理: ${s.title} (ID: ${s.id})`);

            const metadata = await searchTmdb(s.title);

            if (metadata) {
                try {
                    db.prepare(`
                        UPDATE Series SET
                            tmdbId = ?,
                            posterUrl = ?,
                            backdropUrl = ?,
                            overview = ?,
                            voteAverage = ?,
                            year = ?,
                            genres = ?,
                            type = ?,
                            director = ?,
                            cast = ?,
                            tmdbData = ?
                        WHERE id = ?
                    `).run(
                        metadata.tmdbId,
                        metadata.posterUrl,
                        metadata.backdropUrl,
                        metadata.overview,
                        metadata.voteAverage,
                        metadata.year,
                        metadata.genres,
                        metadata.type,
                        metadata.director,
                        metadata.cast,
                        metadata.tmdbData,
                        s.id
                    );

                    console.log(`  ✅ 更新成功`);
                    console.log(`     TMDB ID: ${metadata.tmdbId}`);
                    console.log(`     评分: ${metadata.voteAverage}`);
                    console.log(`     年份: ${metadata.year}`);
                    successCount++;
                } catch (error) {
                    console.error(`  ❌ 数据库更新失败: ${error.message}`);
                    failCount++;
                }
            } else {
                console.log(`  ⚠️  未找到匹配的 TMDB 数据`);
                failCount++;
            }

            console.log();

            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('='.repeat(70));
        console.log('更新完成');
        console.log('='.repeat(70));
        console.log(`成功: ${successCount}`);
        console.log(`失败: ${failCount}`);
        console.log(`总计: ${series.length}`);

    } finally {
        db.close();
    }
}

updateAllMetadata();
