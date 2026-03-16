import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { searchTmdbMetadata } from "@/lib/tmdb/client";
import type { ScannedItem } from "@/types";
import { createOpenListClient } from "@/lib/openlist/client";
import { normalizePath } from "@/lib/openlist/utils";
import { decrypt, isEncrypted } from "@/lib/encryption";
import { sanitizePath } from "@/lib/sanitize";

/**
 * MediaService: 处理媒体导入、元数据富化等核心逻辑
 * 高内聚单一职责：影视导入 / 音乐导入 / 元数据富化
 */
export class MediaService {
    /**
     * 导入影视剧集
     */
    static async importSeries({ inferredTitle, path, configId, videos }: {
        inferredTitle: string;
        path: string;
        configId: number;
        videos: ScannedItem[];
    }) {
        const normalizedSourcePath = normalizePath(sanitizePath(path));

        // 使用 upsert 确保原子性，解决并发扫描冲突
        const series = await prisma.series.upsert({
            where: {
                openlistConfigId_sourcePath: {
                    openlistConfigId: configId,
                    sourcePath: normalizedSourcePath
                }
            },
            update: {
                title: inferredTitle,
                updatedAt: new Date()
            },
            create: {
                title: inferredTitle,
                sourcePath: normalizedSourcePath,
                openlistConfigId: configId,
                type: videos.length === 1 ? "movie" : "tv",
            },
        });

        // 规范化所有视频路径并记录
        const normalizedVideos = videos.map(v => ({
            ...v,
            path: normalizePath(v.path)
        }));

        // 增量入库集数（使用规范化路径校验）
        const existingEpisodes = await prisma.episode.findMany({
            where: { seriesId: series.id, openlistPath: { in: normalizedVideos.map(v => v.path) } },
            select: { openlistPath: true }
        });
        const existingPaths = new Set(existingEpisodes.map(e => e.openlistPath));

        const episodesToCreate = [];
        let newEpisodesCount = 0;
        for (const video of normalizedVideos) {
            if (!existingPaths.has(video.path)) {
                newEpisodesCount++;
                episodesToCreate.push({
                    seriesId: series.id,
                    openlistPath: video.path,
                    title: video.name,
                    seasonNum: video.seasonNum ?? 1,
                    episodeNum: video.episodeNum ?? (series.type === "movie" ? 1 : (existingEpisodes.length + newEpisodesCount)),
                    fileSize: BigInt(video.size),
                });
            }
        }

        if (episodesToCreate.length > 0) {
            await prisma.episode.createMany({
                data: episodesToCreate,
                skipDuplicates: true // 进一步防止并发导致的子资源冲突
            });
        }

        // 异步富化元数据（不阻塞导入响应）
        this.enrichMetadata(series.id, inferredTitle).catch(e =>
            console.error("[MediaService] Metadata enrichment failed:", e)
        );

        return {
            success: true,
            seriesId: series.id,
            totalVideos: videos.length,
            newEpisodes: newEpisodesCount,
            message: `成功导入 ${newEpisodesCount} 个新集数，元数据后台更新中`,
        };
    }

    /**
     * 导入音乐专辑
     */
    static async importMusic({ inferredTitle, path, configId, audios, images, configHost, configToken }: {
        inferredTitle: string;
        path: string;
        configId: number;
        audios: ScannedItem[];
        images: ScannedItem[];
        configHost?: string;
        configToken?: string;
    }) {
        const normalizedSourcePath = normalizePath(sanitizePath(path));
        let coverUrl: string | null = null;
        if (images.length > 0 && configHost && configToken) {
            // 优先匹配标准封面文件名格式，否则取第一张图片
            const coverImg = images.find(img => img.name.match(/^(cover|album|folder|front)\.(jpe?g|png|webp)$/i)) || images[0];
            try {
                // 解密 token（如果已加密）
                const decryptedToken = isEncrypted(configToken) ? decrypt(configToken) : configToken;
                const client = createOpenListClient(configHost, decryptedToken);
                const fileInfo = await client.getFile(normalizePath(coverImg.path));
                coverUrl = fileInfo.raw_url;
            } catch (err) {
                console.warn("[MediaService] Failed to fetch cover direct link:", err);
            }
        }

        // 使用 upsert 确保音频专辑原子化入库
        const album = await prisma.album.upsert({
            where: {
                openlistConfigId_sourcePath: {
                    openlistConfigId: configId,
                    sourcePath: normalizedSourcePath
                }
            },
            update: {
                coverUrl: coverUrl ?? undefined, // 仅在有新封面时更新
            },
            create: {
                title: inferredTitle,
                sourcePath: normalizedSourcePath,
                openlistConfigId: configId,
                coverUrl,
            },
        });

        const normalizedAudios = audios.map(a => ({ ...a, path: normalizePath(a.path) }));

        const existingTracks = await prisma.track.findMany({
            where: { albumId: album.id, openlistPath: { in: normalizedAudios.map(a => a.path) } },
            select: { openlistPath: true },
        });
        const existingTrackPaths = new Set(existingTracks.map(t => t.openlistPath));

        const tracksToCreate = [];
        for (let i = 0; i < normalizedAudios.length; i++) {
            const audio = normalizedAudios[i];
            if (existingTrackPaths.has(audio.path)) continue;

            // 解析曲目序号和标题
            let trackNum = i + 1;
            const match = audio.name.match(/^(\d{1,3})[\s.-]/);
            if (match) trackNum = parseInt(match[1], 10);

            const titleMatch = audio.name.match(/^(?:\d{1,3}[\s.-]+)?(.+)\.\w+$/);
            const title = titleMatch ? titleMatch[1].trim() : audio.name;

            tracksToCreate.push({
                albumId: album.id,
                title,
                trackNum,
                openlistPath: audio.path,
            });
        }

        if (tracksToCreate.length > 0) {
            await prisma.track.createMany({
                data: tracksToCreate,
                skipDuplicates: true
            });
        }

        return {
            success: true,
            albumId: album.id,
            totalAudios: audios.length,
            newTracks: tracksToCreate.length,
        };
    }

    /**
     * 私有：异步元数据富化（TMDB 信息同步）
     */
    private static async enrichMetadata(seriesId: number, title: string) {
        const meta = await searchTmdbMetadata(title);
        if (!meta) return;

        await prisma.series.update({
            where: { id: seriesId },
            data: {
                tmdbId: meta.tmdbId,
                posterUrl: meta.posterUrl,
                backdropUrl: meta.backdropUrl,
                overview: meta.overview,
                year: meta.year,
                voteAverage: meta.voteAverage,
                genres: (meta.genres as Prisma.InputJsonValue) || [],
                type: meta.type,
                director: meta.director || undefined,
                cast: (meta.cast as Prisma.InputJsonValue) || undefined,
                tmdbData: (meta.tmdbData as Prisma.InputJsonValue) || undefined
            },
        });
    }
}
