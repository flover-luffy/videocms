"use client";
import { useState } from "react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            setErrorMsg("请输入有效的邮箱地址");
            return;
        }

        setLoading(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const res = await fetchWithCsrf("/api/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email }),
            });
            const data = await res.json();

            if (res.ok) {
                setSuccessMsg(data.message || "重置链接已发送到您的邮箱");
                setEmail(""); // 清空输入
            } else {
                setErrorMsg(data.error || "发送失败，请稍后重试");
            }
        } catch {
            setErrorMsg("网络请求失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <Navbar />
            <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(80px + 2rem) 1.5rem 4rem" }}>
                <div className="glass fade-in-up" style={{ width: "100%", maxWidth: "400px", padding: "2.5rem", borderRadius: "1.25rem" }}>
                    <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>忘记密码</h1>
                        <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                            输入您的邮箱地址，我们将发送密码重置链接
                        </p>
                    </div>

                    {successMsg ? (
                        <div style={{ 
                            padding: "1rem", 
                            background: "rgba(16, 185, 129, 0.1)", 
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            borderRadius: "0.5rem",
                            marginBottom: "1.5rem"
                        }}>
                            <p style={{ color: "#10b981", fontSize: "0.875rem", margin: 0 }}>
                                ✓ {successMsg}
                            </p>
                            <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", marginTop: "0.5rem", marginBottom: 0 }}>
                                请检查您的邮箱（包括垃圾邮件文件夹）
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <label htmlFor="email" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>
                                    邮箱地址
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    style={{ 
                                        width: "100%", 
                                        background: "var(--color-bg)", 
                                        border: "1px solid var(--color-border)", 
                                        borderRadius: "0.5rem", 
                                        color: "var(--color-text)", 
                                        padding: "0.75rem", 
                                        outline: "none" 
                                    }}
                                />
                            </div>

                            {errorMsg && (
                                <p style={{ color: "#f87171", fontSize: "0.875rem", marginBottom: "1.25rem", textAlign: "center" }}>
                                    {errorMsg}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={loading}
                                style={{ width: "100%", justifyContent: "center", padding: "0.875rem", fontSize: "1rem" }}
                            >
                                {loading ? "发送中..." : "发送重置链接"}
                            </button>
                        </form>
                    )}

                    <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "var(--color-muted)" }}>
                        <Link href="/login" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                            返回登录
                        </Link>
                        {" · "}
                        <Link href="/register" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                            注册账号
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
