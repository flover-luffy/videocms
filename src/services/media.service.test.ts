import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaService } from './media.service';
import { prisma } from '@/lib/db';
import { searchTmdbMetadata } from '@/lib/tmdb/client';

// 拦截数据库 Prisma 实例
vi.mock('@/lib/db', () => ({
    prisma: {
        series: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        episode: {
            findMany: vi.fn(),
            createMany: vi.fn(),
        }
    }
}));

// 拦截外部抓取逻辑
vi.mock('@/lib/tmdb/client', () => ({
    searchTmdbMetadata: vi.fn()
}));

describe('MediaService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('当导入新剧集或电影时，应触发主对象与子集的级联新建', async () => {
        // 空库情景
        (prisma.series.findFirst as any).mockResolvedValue(null);
        (prisma.series.create as any).mockResolvedValue({ id: 1, title: 'Test Series', type: 'tv' });
        (prisma.episode.findMany as any).mockResolvedValue([]);
        // 拦截后台富化
        (searchTmdbMetadata as any).mockResolvedValue(null);

        const result = await MediaService.importSeries({
            inferredTitle: 'Test Series',
            path: '/tv/test',
            configId: 1,
            videos: [
                { path: '/tv/test/ep1.mp4', name: 'ep1.mp4', size: 1000, category: 'video' as any }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.newEpisodes).toBe(1);
        expect(prisma.series.create).toHaveBeenCalled();
        expect(prisma.episode.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({ title: 'ep1.mp4', episodeNum: 1 }) // 推断逻辑
            ])
        });
    });

    it('当重复导入该剧集并新增子集时，主对象应执行合并，子集入库时能实现自跳过去的排重效果', async () => {
        // 非空库情景：该剧集已存在
        (prisma.series.findFirst as any).mockResolvedValue({ id: 1, title: 'Valid Series', type: 'tv' });
        (prisma.series.update as any).mockResolvedValue({ id: 1, title: 'Valid Series', type: 'tv' });
        // 但该剧集数据库里目前只入库了 ep1
        (prisma.episode.findMany as any).mockResolvedValue([
            { openlistPath: '/tv/test/ep1.mp4' }
        ]);
        (searchTmdbMetadata as any).mockResolvedValue(null);

        const result = await MediaService.importSeries({
            inferredTitle: 'Valid Series',
            path: '/tv/test',
            configId: 1,
            videos: [
                { path: '/tv/test/ep1.mp4', name: 'ep1.mp4', size: 1000, category: 'video' as any },
                { path: '/tv/test/ep2.mp4', name: 'ep2.mp4', size: 2000, category: 'video' as any }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.newEpisodes).toBe(1); // ep1 被自动跳过了，ep2 新增入账
        expect(prisma.series.update).toHaveBeenCalled();
        expect(prisma.episode.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({ title: 'ep2.mp4' })
            ])
        });
    });
});
