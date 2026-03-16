"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchWithCsrf } from "@/lib/fetch-client";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // 密码强度规则
    const passwordRules = [
        { label: "至少 12 个字符", valid: password.length >= 12 },
        { label: "包含大写字母", valid: /[A-Z]/.test(password) },
        { label: "包含数字", valid: /[0-9]/.test(password) },
        { label: "包含特殊字符 (!@#$%^&*)", valid: /[!@#$%^&*]/.test(password) }
    ];
    const isPasswordValid = passwordRules.every(r => r.valid);

    useEffect(() => {
        if (!token) {
            setErrorMsg("无效的重置链接");
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            setErrorMsg("无效的重置链接");
            return;
        }

        if (!password || !confirmPassword) {
            setErrorMsg("请填写完整信息");
            return;
        }

        if (password !== confirmPassword) {
            setErrorMsg("两次输入的密码不一致");
            return;
        }

        if (!isPasswordValid) {
            setErrorMsg("密码不符合安全要求");
            return;
        }

        setLoading(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const res = await fetchWithCsrf("/api/auth/reset-password", {
                method: "POST",
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();

            if (res.ok) {
                setSuccessMsg(data.message || "密码重置成功");
                // 3 秒后跳转到登录页
                setTimeout(() => {
                    router.push("/login");
                }, 3000);
            } else {
                setErrorMsg(data.error || "重置失败，请重试");
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
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>重置密码</h1>
                        <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                            请输入您的新密码
                        </p>
                    </div>

                    {successMsg ? (
                        <div style={{ 
                            padding: "1.5rem", 
                            background: "rgba(16, 185, 129, 0.1)", 
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            borderRadius: "0.5rem",
                            textAlign: "center"
                        }}>
                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
                            <p style={{ color: "#10b981", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                                {successMsg}
                            </p>
                            <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", margin: 0 }}>
                                正在跳转到登录页...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate>
                            <div style={{ marginBottom: "1.25rem" }}>
                                <label htmlFor="password" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>
                                    新密码
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    className="form-input"
                                    placeholder="输入新密码"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={!token}
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
                                {password && (
                                    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "0.75rem" }}>
                                        {passwordRules.map((rule, idx) => (
                                            <div key={idx} style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.5rem",
                                                fontSize: "0.75rem",
                                                color: rule.valid ? "#10b981" : "var(--color-muted)",
                                                transition: "color 0.3s ease",
                                            }}>
                                                <span style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    width: "1.125rem",
                                                    height: "1.125rem",
                                                    borderRadius: "50%",
                                                    backgroundColor: rule.valid ? "rgba(16, 185, 129, 0.15)" : "transparent",
                                                    border: rule.valid ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--color-border)",
                                                    transition: "all 0.3s ease"
                                                }}>
                                                    {rule.valid ? "✓" : ""}
                                                </span>
                                                {rule.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: "1.5rem" }}>
                                <label htmlFor="confirmPassword" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>
                                    确认密码
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    required
                                    className="form-input"
                                    placeholder="再次输入新密码"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={!token}
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
                                disabled={loading || !token}
                                style={{ width: "100%", justifyContent: "center", padding: "0.875rem", fontSize: "1rem" }}
                            >
                                {loading ? "重置中..." : "重置密码"}
                            </button>
                        </form>
                    )}

                    <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "var(--color-muted)" }}>
                        <Link href="/login" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                            返回登录
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "var(--color-muted)" }}>加载中...</div>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
