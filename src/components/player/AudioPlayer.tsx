"use client";
import { useState, useRef, useEffect } from "react";

interface TrackItem {
  id: number;
  title: string;
  artist: string | null;
  duration: number | null;
  trackNum: number | null;
}

export default function AudioPlayer({ tracks }: { tracks: TrackItem[] }) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const playTrack = async (index: number) => {
    if (index < 0 || index >= tracks.length) return;
    setCurrentTrackIndex(index);
    setLoading(true);
    const track = tracks[index];

    try {
      const res = await fetch(`/api/music/play/track/${track.id}`);
      const data = await res.json();
      if (data.url || data.proxyUrl) {
        // 优先使用源地址，也可以降级用代理
        setAudioUrl(data.url || data.proxyUrl);
      } else {
        alert("无法解析播放地址");
      }
    } catch (error) {
      console.error("加载音频失败:", error);
      alert("加载音频失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      // 当 url 改变时，HTML5 Audio 自动从新源加载并尝试播放
      audioRef.current.play().catch(console.error);
    }
  }, [audioUrl]);

  const handleEnded = () => {
    // 自动播放下一首
    if (currentTrackIndex + 1 < tracks.length) {
      playTrack(currentTrackIndex + 1);
    }
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2
        style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}
      >
        曲目列表{" "}
        <span
          style={{
            color: "var(--color-muted)",
            fontSize: "0.875rem",
            fontWeight: 400,
          }}
        >
          ({tracks.length} 首)
        </span>
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {tracks.map((track, index) => {
          const isActive = currentTrackIndex === index;
          return (
            <div
              key={track.id}
              onClick={() => playTrack(index)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                background: isActive
                  ? "rgba(59,130,246,0.15)"
                  : "var(--color-surface)",
                border: isActive
                  ? "1px solid rgba(59,130,246,0.3)"
                  : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              className="hover:bg-white/5"
            >
              <div
                style={{
                  width: "24px",
                  color: isActive
                    ? "var(--color-primary)"
                    : "var(--color-muted)",
                  textAlign: "center",
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {loading && isActive ? (
                  <span style={{ fontSize: "0.875rem" }}>⏳</span>
                ) : isActive ? (
                  "▶"
                ) : (
                  track.trackNum || index + 1
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#D97706" : "var(--color-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {track.title}
                </div>
                {track.artist && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-muted)",
                      marginTop: "0.125rem",
                    }}
                  >
                    {track.artist}
                  </div>
                )}
              </div>
              {track.duration && (
                <div
                  style={{
                    color: "var(--color-muted)",
                    fontSize: "0.75rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.floor(track.duration / 60)}:
                  {(track.duration % 60).toString().padStart(2, "0")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 贴靠底部的播放控制台 */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--color-border)",
          padding: "0.75rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 40,
          transform:
            currentTrackIndex >= 0 ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          style={{
            maxWidth: "800px",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "white",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentTrackIndex >= 0
                ? tracks[currentTrackIndex].title
                : "准备就绪"}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentTrackIndex >= 0
                ? tracks[currentTrackIndex].artist || "未提供艺术家名"
                : "-"}
            </div>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            autoPlay
            onEnded={handleEnded}
            style={{
              height: "36px",
              width: "100%",
              maxWidth: "480px",
              borderRadius: "0.25rem",
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* 仅仅为了占位防止列表被底部播放器遮挡 */}
      {currentTrackIndex >= 0 && <div style={{ height: "80px" }} />}
    </div>
  );
}
