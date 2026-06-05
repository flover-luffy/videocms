"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

interface AlbumItem {
  id: number;
  title: string;
  artist: string;
  coverUrl: string | null;
  year: number | null;
  _count: { tracks: number };
}

export default function MusicLibraryPage() {
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const res = await fetch("/api/music/albums");
        const data = await res.json();
        if (data.items) {
          setAlbums(data.items);
        } else if (data.error) {
          setError(data.error);
        }
      } catch (error) {
        console.error("[MusicLibrary] 获取专辑列表失败:", error);
        setError("网络请求失败");
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  return (
    <>
      <Navbar />
      <main
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "calc(80px + 2rem) 1.5rem 4rem",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            marginBottom: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: "0.5rem",
              }}
            >
              🎵 音乐发现
            </h1>
            <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem" }}>
              从这里开始你的独立数字唱片集
            </p>
          </div>
        </div>

        {loading && (
          <div
            style={{
              padding: "4rem 0",
              textAlign: "center",
              color: "var(--color-muted)",
            }}
          >
            载入唱片柜中...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "1rem",
              color: "#f87171",
              background: "rgba(239,68,68,0.1)",
              borderRadius: "0.5rem",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && albums.length === 0 && (
          <div
            className="glass fade-in-up"
            style={{
              padding: "4rem 2rem",
              textAlign: "center",
              borderRadius: "1rem",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎧</div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                marginBottom: "0.5rem",
              }}
            >
              音乐库还是空的
            </h2>
            <p style={{ color: "var(--color-muted)" }}>
              请在管理后台接入音频资源，构建你的私人流媒体库。
            </p>
          </div>
        )}

        {!loading && albums.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "1.5rem",
            }}
            className="fade-in-up"
          >
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/library/music/album/${album.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                  transition: "transform 0.2s",
                }}
                className="hover:scale-[1.02]"
              >
                <div
                  style={{
                    aspectRatio: "1/1",
                    background: album.coverUrl
                      ? `url(${album.coverUrl}) center/cover`
                      : "linear-gradient(135deg, #1e293b, #0f172a)",
                    borderRadius: "0.75rem",
                    marginBottom: "0.75rem",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: "0.5rem",
                      right: "0.5rem",
                      background: "rgba(0,0,0,0.7)",
                      backdropFilter: "blur(4px)",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    {album._count.tracks} 首
                  </div>
                </div>
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    marginBottom: "0.25rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {album.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--color-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {album.artist || "群星"} {album.year && `• ${album.year}`}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
