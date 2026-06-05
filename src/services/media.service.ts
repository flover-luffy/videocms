import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { searchTmdbMetadata } from "@/lib/tmdb/client";
import type { ScannedItem } from "@/types";
import { createOpenListClient } from "@/lib/openlist/client";
import { normalizePath } from "@/lib/openlist/utils";
import { decrypt, isEncrypted } from "@/lib/encryption";
import { sanitizePath } from "@/lib/sanitize";
import { batchCheckExisting, withTransaction } from "@/lib/import-batch";
import { AppError } from "@/lib/errors";
import logger from "@/lib/logger";

export class MediaService {
  private static async resolveAlbumCoverUrl(
    images: ScannedItem[],
    configHost?: string,
    configToken?: string,
  ): Promise<string | null> {
    if (images.length === 0 || !configHost || !configToken) {
      return null;
    }

    const coverImg =
      images.find((img) =>
        img.name.match(/^(cover|album|folder|front)\.(jpe?g|png|webp)$/i),
      ) || images[0];

    try {
      const decryptedToken = isEncrypted(configToken)
        ? decrypt(configToken)
        : configToken;
      const client = createOpenListClient(configHost, decryptedToken);
      const fileInfo = await client.getFile(normalizePath(coverImg.path));
      return fileInfo.raw_url;
    } catch (err) {
      logger.warn("[MediaService] Failed to fetch cover direct link:", err);
      return null;
    }
  }

  static async importSeries({
    inferredTitle,
    path,
    configId,
    videos,
  }: {
    inferredTitle: string;
    path: string;
    configId: number;
    videos: ScannedItem[];
  }) {
    try {
      const normalizedSourcePath = normalizePath(sanitizePath(path));
      const startTime = Date.now();

      const result = await withTransaction(async (tx) => {
        const existing = await tx.series.findUnique({
          where: {
            openlistConfigId_sourcePath: {
              openlistConfigId: configId,
              sourcePath: normalizedSourcePath,
            },
          },
          select: {
            id: true,
            manualMatched: true,
          },
        });
        const inferredType = videos.length === 1 ? "movie" : "tv";

        const series = existing
          ? await tx.series.update({
              where: { id: existing.id },
              data: {
                // 手动匹配后的条目保留手工绑定标题，不在扫描时回写目录推断标题
                ...(existing.manualMatched ? {} : { title: inferredTitle }),
                updatedAt: new Date(),
              },
            })
          : await tx.series.create({
              data: {
                title: inferredTitle,
                sourcePath: normalizedSourcePath,
                openlistConfigId: configId,
                type: inferredType,
              },
            });

        const normalizedVideos = videos.map((video) => ({
          ...video,
          path: normalizePath(video.path),
        }));

        const existingPaths = await batchCheckExisting(
          tx.episode,
          "seriesId",
          { seriesId: series.id },
          "openlistPath",
          normalizedVideos.map((video) => video.path),
        );

        const episodesToCreate = [];
        let newEpisodesCount = 0;

        for (let i = 0; i < normalizedVideos.length; i++) {
          const video = normalizedVideos[i];
          if (!existingPaths.has(video.path)) {
            newEpisodesCount++;
            episodesToCreate.push({
              seriesId: series.id,
              openlistPath: video.path,
              title: video.name,
              seasonNum: video.seasonNum ?? 1,
              episodeNum:
                video.episodeNum ?? (series.type === "movie" ? 1 : i + 1),
              fileSize: BigInt(video.size),
            });
          }
        }

        if (episodesToCreate.length > 0) {
          await tx.episode.createMany({
            data: episodesToCreate,
            skipDuplicates: true,
          });
        }

        return {
          seriesId: series.id,
          shouldAutoEnrich: !series.manualMatched,
          newEpisodesCount,
          totalVideos: videos.length,
          duration: Date.now() - startTime,
        };
      });

      if (result.shouldAutoEnrich) {
        this.enrichMetadata(result.seriesId, inferredTitle).catch((err) =>
          logger.error("[MediaService] Metadata enrichment failed:", err),
        );
      }

      return {
        success: true,
        seriesId: result.seriesId,
        totalVideos: result.totalVideos,
        newEpisodes: result.newEpisodesCount,
        duration: result.duration,
        message: `成功导入 ${result.newEpisodesCount} 个新集数，元数据后台更新中`,
      };
    } catch (error) {
      logger.error("[MediaService] Failed to import series:", error);
      throw new AppError(
        `导入剧集失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
  }

  static async importMusic({
    inferredTitle,
    path,
    configId,
    audios,
    images,
    configHost,
    configToken,
  }: {
    inferredTitle: string;
    path: string;
    configId: number;
    audios: ScannedItem[];
    images: ScannedItem[];
    configHost?: string;
    configToken?: string;
  }) {
    try {
      const normalizedSourcePath = normalizePath(sanitizePath(path));
      const startTime = Date.now();
      const coverUrl = await this.resolveAlbumCoverUrl(
        images,
        configHost,
        configToken,
      );

      const result = await withTransaction(async (tx) => {
        const album = await tx.album.upsert({
          where: {
            openlistConfigId_sourcePath: {
              openlistConfigId: configId,
              sourcePath: normalizedSourcePath,
            },
          },
          update: {
            coverUrl: coverUrl ?? undefined,
          },
          create: {
            title: inferredTitle,
            sourcePath: normalizedSourcePath,
            openlistConfigId: configId,
            coverUrl,
          },
        });

        const normalizedAudios = audios.map((audio) => ({
          ...audio,
          path: normalizePath(audio.path),
        }));

        const existingTrackPaths = await batchCheckExisting(
          tx.track,
          "albumId",
          { albumId: album.id },
          "openlistPath",
          normalizedAudios.map((audio) => audio.path),
        );

        const tracksToCreate = [];
        for (let i = 0; i < normalizedAudios.length; i++) {
          const audio = normalizedAudios[i];
          if (existingTrackPaths.has(audio.path)) {
            continue;
          }

          let trackNum = i + 1;
          const match = audio.name.match(/^(\d{1,3})[\s.-]/);
          if (match) {
            trackNum = parseInt(match[1], 10);
          }

          const titleMatch = audio.name.match(/^(?:\d{1,3}[\s.-]+)?(.+)\.\w+$/);
          const title = titleMatch ? titleMatch[1].trim() : audio.name;

          tracksToCreate.push({
            albumId: album.id,
            title,
            trackNum,
            openlistPath: audio.path,
          });
        }

        let newTracksCount = 0;
        if (tracksToCreate.length > 0) {
          const batchResult = await tx.track.createMany({
            data: tracksToCreate,
            skipDuplicates: true,
          });
          newTracksCount = batchResult.count;
        }

        return {
          albumId: album.id,
          newTracksCount,
          totalAudios: audios.length,
          duration: Date.now() - startTime,
        };
      });

      return {
        success: true,
        albumId: result.albumId,
        totalAudios: result.totalAudios,
        newTracks: result.newTracksCount,
        duration: result.duration,
      };
    } catch (error) {
      logger.error("[MediaService] Failed to import music:", error);
      throw new AppError(
        `导入音乐失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
  }

  private static async enrichMetadata(seriesId: number, title: string) {
    try {
      const meta = await searchTmdbMetadata(title);
      if (!meta) {
        return;
      }

      // 仅允许自动补全更新”未手动锁定”的条目，避免手动匹配结果被后续扫描覆盖
      await prisma.series.updateMany({
        where: {
          id: seriesId,
          manualMatched: false,
        },
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
          tmdbData: (meta.tmdbData as Prisma.InputJsonValue) || undefined,
        },
      });
    } catch (error) {
      logger.error('[MediaService] Failed to enrich metadata:', error);
      throw new AppError(
        `元数据补全失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
  }
}
