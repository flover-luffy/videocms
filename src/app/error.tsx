"use client";

/**
 * Next.js App Router 全局错误页面
 * 自动捕获同级及子级路由的运行时异常，展示友好错误 UI
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
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
            <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>⚠️</div>

            <h1
                style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    marginBottom: "0.75rem",
                    background: "linear-gradient(135deg, #f87171, #ef4444)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                }}
            >
                出错了
            </h1>

            <p
                style={{
                    fontSize: "0.9rem",
                    color: "#9ca3af",
                    marginBottom: "0.5rem",
                    maxWidth: "480px",
                }}
            >
                服务器遇到了一个意外错误，请稍后再试。
            </p>

            {error.digest && (
                <p
                    style={{
                        fontSize: "0.75rem",
                        color: "#6b7280",
                        marginBottom: "1.5rem",
                    }}
                >
                    错误代码：{error.digest}
                </p>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                    onClick={reset}
                    style={{
                        padding: "0.625rem 1.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#fff",
                        backgroundColor: "#6366f1",
                        border: "none",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                >
                    重新加载
                </button>

                <button
                    onClick={() => (window.location.href = "/")}
                    style={{
                        padding: "0.625rem 1.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#d1d5db",
                        backgroundColor: "transparent",
                        border: "1px solid #374151",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                >
                    返回首页
                </button>
            </div>
        </div>
    );
}
