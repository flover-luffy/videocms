"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithCsrf } from "@/lib/fetch-client";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email || !formData.password) {
            setErrorMsg("请输入邮箱和密码");
            return;
        }

        setLoading(true);
        setErrorMsg("");

        try {
            const res = await fetchWithCsrf("/api/auth/login", {
                method: "POST",
                body: JSON.stringify(formData),
            });
            const data = await res.json();

            if (res.ok) {
                // 保存 access token（虽然 SSR 主要依靠 refresh token，但前端带在请求头更标准）
                localStorage.setItem("access_token", data.accessToken);
                // 简单触发事件，让 Navbar 感知状态变化
                window.dispatchEvent(new Event("auth-changed"));
                router.push("/");
            } else {
                setErrorMsg(data.error || "登录失败");
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
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>欢迎回来</h1>
                        <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>登录您的 Rom&apos;s Cinema 账号以漫游播放记录</p>
                    </div>

                    <form onSubmit={handleLogin} noValidate>
                        <div style={{ marginBottom: "1.25rem" }}>
                            <label htmlFor="email" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>邮箱地址</label>
                            <input
                                id="email"
                                type="email"
                                required
                                className="form-input"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                                style={{ width: "100%", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "0.5rem", color: "var(--color-text)", padding: "0.75rem", outline: "none" }}
                            />
                        </div>

                        <div style={{ marginBottom: "1.5rem" }}>
                            <label htmlFor="password" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>密码</label>
                            <input
                                id="password"
                                type="password"
                                required
                                className="form-input"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                                style={{ width: "100%", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "0.5rem", color: "var(--color-text)", padding: "0.75rem", outline: "none" }}
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
                            {loading ? "登录中..." : "登 录"}
                        </button>
                    </form>

                    <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.875rem" }}>
                        <Link href="/forgot-password" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                            忘记密码？
                        </Link>
                    </div>

                    <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "var(--color-muted)" }}>
                        还没有账号？{" "}
                        <Link href="/register" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                            立即注册
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
