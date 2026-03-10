"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithCsrf } from "@/lib/fetch-client";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: "", password: "", confirm: "" });
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email || !formData.password) {
            setErrorMsg("请输入邮箱和密码");
            return;
        }
        if (formData.password !== formData.confirm) {
            setErrorMsg("两次输入的密码不一致");
            return;
        }
        if (formData.password.length < 6) {
            setErrorMsg("密码长度不能小于 6 位");
            return;
        }

        setLoading(true);
        setErrorMsg("");

        try {
            const res = await fetchWithCsrf("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ email: formData.email, password: formData.password }),
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem("access_token", data.accessToken);
                window.dispatchEvent(new Event("auth-changed"));
                router.push("/");
            } else {
                setErrorMsg(data.error || "注册失败");
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
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>创建新账号</h1>
                        <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>加入我们，随时随地同步您的 Rom&apos;s Cinema 进度</p>
                    </div>

                    <form onSubmit={handleRegister} noValidate>
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

                        <div style={{ marginBottom: "1.25rem" }}>
                            <label htmlFor="password" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>密码</label>
                            <input
                                id="password"
                                type="password"
                                required
                                className="form-input"
                                placeholder="至少 6 位密码"
                                value={formData.password}
                                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                                style={{ width: "100%", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "0.5rem", color: "var(--color-text)", padding: "0.75rem", outline: "none" }}
                            />
                        </div>

                        <div style={{ marginBottom: "1.5rem" }}>
                            <label htmlFor="confirm" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>确认密码</label>
                            <input
                                id="confirm"
                                type="password"
                                required
                                className="form-input"
                                placeholder="再次输入密码"
                                value={formData.confirm}
                                onChange={(e) => setFormData((p) => ({ ...p, confirm: e.target.value }))}
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
                            {loading ? "提交中..." : "注 册"}
                        </button>
                    </form>

                    <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "var(--color-muted)" }}>
                        已有账号？{" "}
                        <Link href="/login" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                            直接登录
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
