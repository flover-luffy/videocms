"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithCsrf } from "@/lib/fetch-client";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: "", captcha: "", code: "", password: "", confirm: "" });
    const [captchaSvg, setCaptchaSvg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false); // This state will now handle both general loading and send code loading
    const [errorMsg, setErrorMsg] = useState("");
    const [countdown, setCountdown] = useState(0);

    const fetchCaptcha = async () => {
        try {
            const res = await fetch('/api/auth/captcha', { cache: 'no-store' });
            const data = await res.json();
            if (data.svg) setCaptchaSvg(data.svg);
        } catch (err) {
            console.error('Failed to fetch captcha:', err);
        }
    };

    useEffect(() => {
        fetchCaptcha();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    // 处理发送验证码
    const handleSendCode = async () => {
        if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
            setErrorMsg("请输入有效的邮箱地址");
            return;
        }
        if (!formData.captcha) {
            setErrorMsg("请输入图形验证码");
            return;
        }

        setLoading(true); // Use 'loading' for send code
        setErrorMsg("");

        try {
            const res = await fetchWithCsrf("/api/auth/send-code", {
                method: "POST",
                body: JSON.stringify({ email: formData.email, captcha: formData.captcha }),
            });
            const data = await res.json();

            if (res.ok) {
                setCountdown(60);
                const timer = setInterval(() => {
                    setCountdown((prev) => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                setErrorMsg(data.error || "发送失败");
                fetchCaptcha(); // Refresh captcha on error
            }
        } catch {
            setErrorMsg("发生错误，请稍后重试");
        } finally {
            setLoading(false); // Use 'loading' for send code
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email || !formData.code || !formData.password) {
            setErrorMsg("请填写完整注册信息");
            return;
        }
        if (formData.password !== formData.confirm) {
            setErrorMsg("两次输入的密码不一致");
            return;
        }
        if (formData.password.length < 12) {
            setErrorMsg("密码长度不能小于 12 位");
            return;
        }

        setLoading(true);
        setErrorMsg("");

        try {
            const res = await fetchWithCsrf("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    email: formData.email,
                    code: formData.code,
                    password: formData.password
                }),
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
                        {/* 邮箱 */}
                        <div style={{ marginBottom: "1.25rem" }}>
                            <label htmlFor="email" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>邮箱地址</label>
                            <input
                                id="email"
                                type="email"
                                required
                                className="form-input"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                style={{ width: "100%", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "0.5rem", color: "var(--color-text)", padding: "0.75rem", outline: "none" }}
                            />
                        </div>

                        {/* 图形验证码 */}
                        <div style={{ marginBottom: "1.25rem" }}>
                            <label htmlFor="captcha" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>图形验证码</label>
                            <div style={{ display: "flex", gap: "0.75rem" }}>
                                <input
                                    id="captcha"
                                    type="text"
                                    required
                                    placeholder="输入图中数字"
                                    className="form-input"
                                    value={formData.captcha}
                                    onChange={handleChange}
                                    maxLength={4}
                                    style={{ flex: 1, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "0.5rem", color: "var(--color-text)", padding: "0.75rem", outline: "none" }}
                                />
                                <div
                                    style={{ width: "100px", height: "44px", borderRadius: "0.5rem", background: "var(--color-bg)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}
                                    onClick={fetchCaptcha}
                                    title="点击刷新验证码"
                                >
                                    {captchaSvg ? (
                                        <div
                                            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                                            dangerouslySetInnerHTML={{ __html: captchaSvg }}
                                        />
                                    ) : (
                                        <div style={{ width: "20px", height: "20px", border: "2px solid var(--color-primary)", borderTopColor: "transparent", animation: "spin 1s linear infinite", borderRadius: "50%" }} />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: "1.25rem" }}>
                            <label htmlFor="code" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>验证码</label>
                            <div style={{ display: "flex", gap: "0.75rem" }}>
                                <input
                                    id="code"
                                    type="text"
                                    required
                                    maxLength={6}
                                    className="form-input"
                                    placeholder="6 位验证码"
                                    value={formData.code}
                                    onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.replace(/\D/g, '') }))}
                                    style={{ flex: 1, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "0.5rem", color: "var(--color-text)", padding: "0.75rem", outline: "none" }}
                                />
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={loading || countdown > 0}
                                    className="btn-outline"
                                    style={{ whiteSpace: "nowrap", padding: "0 1rem", fontSize: "0.875rem", minWidth: "100px", color: countdown > 0 ? "var(--color-muted)" : "var(--color-primary)" }}
                                >
                                    {countdown > 0 ? `${countdown}s` : (loading ? "发送中..." : "获取验证码")}
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: "1.25rem" }}>
                            <label htmlFor="password" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)", marginBottom: "0.5rem" }}>密码</label>
                            <input
                                id="password"
                                type="password"
                                required
                                className="form-input"
                                placeholder="至少 12 位，含数字、大小写、特殊符号"
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

