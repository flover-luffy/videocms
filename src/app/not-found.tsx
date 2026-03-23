import Link from "next/link";

/**
 * 404 页面
 * 统一的友好 404 展示，取代默认的白屏 404
 */
export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "'Inter', sans-serif",
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)",
        color: "#e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: "6rem",
          fontWeight: 800,
          lineHeight: 1,
          marginBottom: "1rem",
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        404
      </div>

      <h1
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
        }}
      >
        页面走丢了
      </h1>

      <p
        style={{
          fontSize: "0.875rem",
          color: "#9ca3af",
          marginBottom: "1.5rem",
          maxWidth: "400px",
        }}
      >
        你访问的页面不存在或已被移除，请检查网址是否正确。
      </p>

      <Link
        href="/"
        style={{
          padding: "0.625rem 1.5rem",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "#fff",
          backgroundColor: "#6366f1",
          border: "none",
          borderRadius: "0.5rem",
          textDecoration: "none",
          transition: "all 0.2s",
        }}
      >
        返回首页
      </Link>
    </div>
  );
}
