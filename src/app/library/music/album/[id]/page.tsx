import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import type { Metadata } from "next";
import AudioPlayer from "@/components/player/AudioPlayer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const album = await prisma.album.findUnique({
    where: { id: parseInt(id, 10) },
    select: { title: true, artist: true },
  });
  if (!album) return { title: "未找到专辑" };
  return {
    title: `${album.title} - ${album.artist || "群星"}`,
  };
}

export default async function AlbumPage({ params }: PageProps) {
  const { id } = await params;
  const albumId = parseInt(id, 10);

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: {
      tracks: {
        orderBy: [{ trackNum: "asc" }],
      },
    },
  });

  if (!album) notFound();

  return (
    <>
      <Navbar />

      <main
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "calc(80px + 1.5rem) 1.5rem 6rem",
        }}
      >
        {/* 面包屑导航 */}
        <nav
          aria-label="页面路径"
          style={{
            marginBottom: "2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.875rem",
            color: "var(--color-muted)",
          }}
        >
          <Link
            href="/library/music"
            style={{ color: "var(--color-muted)", transition: "color 0.2s" }}
            className="hover:text-white"
          >
            音乐库
          </Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: "var(--color-text)" }}>{album.title}</span>
        </nav>

        {/* 专辑抬头块 */}
        <header
          style={{
            display: "flex",
            gap: "2rem",
            alignItems: "flex-end",
            flexWrap: "wrap",
            marginBottom: "3rem",
          }}
          className="fade-in-up"
        >
          <div
            style={{
              width: "clamp(160px, 30vw, 240px)",
              aspectRatio: "1/1",
              background: album.coverUrl
                ? `url(${album.coverUrl}) center/cover`
                : "linear-gradient(135deg, #1e293b, #0f172a)",
              borderRadius: "1rem",
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            }}
          />

          <div style={{ flex: 1, minWidth: "280px" }}>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              专 辑
            </span>
            <h1
              style={{
                fontSize: "clamp(2rem, 5vw, 4rem)",
                fontWeight: 900,
                lineHeight: 1.1,
                margin: "0.5rem 0",
                letterSpacing: "-0.03em",
              }}
            >
              {album.title}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                color: "var(--color-text)",
                fontWeight: 600,
                flexWrap: "wrap",
              }}
            >
              {album.artist && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "var(--color-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                    }}
                  >
                    {album.artist.charAt(0)}
                  </div>
                  {album.artist}
                </span>
              )}
              {album.year && (
                <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
                  • {album.year}
                </span>
              )}
              <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
                • {album.tracks.length} 首歌
              </span>
              {album.genre && <span className="genre-tag">{album.genre}</span>}
            </div>
          </div>
        </header>

        {/* 音乐播放大组件注入点 */}
        {album.tracks.length > 0 ? (
          <AudioPlayer tracks={album.tracks} />
        ) : (
          <div
            className="glass"
            style={{
              padding: "4rem 2rem",
              textAlign: "center",
              borderRadius: "1rem",
            }}
          >
            <p style={{ color: "var(--color-muted)" }}>这张专辑暂无曲目信息</p>
          </div>
        )}
      </main>
    </>
  );
}
