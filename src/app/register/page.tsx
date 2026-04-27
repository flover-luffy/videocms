/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import AuthShell from "@/components/layout/AuthShell";
import { fetchWithCsrf } from "@/lib/fetch-client";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    captcha: "",
    code: "",
    password: "",
    confirm: "",
  });
  const [captchaSvg, setCaptchaSvg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(0);

  const passwordRules = [
    { label: "至少 12 个字符", valid: formData.password.length >= 12 },
    { label: "包含大写字母", valid: /[A-Z]/.test(formData.password) },
    { label: "包含数字", valid: /[0-9]/.test(formData.password) },
    {
      label: "包含特殊字符 (!@#$%^&*)",
      valid: /[!@#$%^&*]/.test(formData.password),
    },
  ];
  const isPasswordValid = passwordRules.every((rule) => rule.valid);

  const fetchCaptcha = async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/auth/captcha", {
        cache: "no-store",
        signal,
      });
      const data = await response.json();
      setCaptchaSvg(data.svg || null);
    } catch (error) {
      const requestError = error as Error;
      if (signal?.aborted || requestError.name === "AbortError") {
        return;
      }
      console.error("Failed to fetch captcha:", error);
      setCaptchaSvg(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchCaptcha(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => setCountdown((current) => current - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    setFormData((previous) => ({ ...previous, [id]: value }));
  };

  const handleSendCode = async () => {
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      setErrorMsg("请输入有效的邮箱地址。");
      return;
    }

    if (!formData.captcha) {
      setErrorMsg("请输入图形验证码。");
      return;
    }

    setSendingCode(true);
    setErrorMsg("");

    try {
      const response = await fetchWithCsrf("/api/auth/send-code", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          captcha: formData.captcha,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setCountdown(60);
      } else {
        setErrorMsg(data.error || "验证码发送失败，请刷新后重试。");
        void fetchCaptcha();
      }
    } catch {
      setErrorMsg("验证码发送失败，请稍后重试。");
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.email || !formData.code || !formData.password) {
      setErrorMsg("请完整填写注册信息。");
      return;
    }

    if (formData.password !== formData.confirm) {
      setErrorMsg("两次输入的密码不一致。");
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg("密码未满足安全要求，请先修正。");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const response = await fetchWithCsrf("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          code: formData.code,
          password: formData.password,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        router.push("/");
      } else {
        setErrorMsg(data.error || "注册失败，请稍后重试。");
      }
    } catch {
      setErrorMsg("网络请求失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="注册 Rom's Cinema">
      <form onSubmit={handleRegister} noValidate className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-slate-300"
          >
            邮箱地址
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="form-input"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="captcha"
            className="block text-sm font-semibold text-slate-300"
          >
            图形验证码
          </label>
          <div className="flex gap-3">
            <input
              id="captcha"
              type="text"
              required
              maxLength={6}
              className="form-input flex-1"
              placeholder="输入图片中的 6 位字符"
              value={formData.captcha}
              onChange={handleChange}
            />
            <button
              type="button"
              className="flex h-[52px] w-[112px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 px-3"
              title="点击刷新验证码"
              onClick={() => void fetchCaptcha()}
            >
              {captchaSvg ? (
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg)}`}
                  alt="验证码"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="code"
            className="block text-sm font-semibold text-slate-300"
          >
            邮箱验证码
          </label>
          <div className="flex gap-3">
            <input
              id="code"
              type="text"
              required
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="form-input flex-1"
              placeholder="输入 6 位验证码"
              value={formData.code}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  code: event.target.value.replace(/\D/g, ""),
                }))
              }
            />
            <button
              type="button"
              className="btn-outline min-w-[116px] px-4 text-sm"
              disabled={sendingCode || countdown > 0}
              onClick={() => void handleSendCode()}
            >
              {countdown > 0
                ? `${countdown}s`
                : sendingCode
                  ? "发送中..."
                  : "获取验证码"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-slate-300"
          >
            密码
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            className="form-input"
            placeholder="输入满足安全要求的密码"
            value={formData.password}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                password: event.target.value,
              }))
            }
          />

          {formData.password ? (
            <div className="fade-in space-y-2 rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              {passwordRules.map((rule) => (
                <div
                  key={rule.label}
                  className="flex items-center gap-3 text-xs"
                >
                  <span
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border ${
                      rule.valid
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 text-slate-500"
                    }`}
                  >
                    {rule.valid ? "✓" : ""}
                  </span>
                  <span
                    className={
                      rule.valid ? "text-emerald-300" : "text-slate-400"
                    }
                  >
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirm"
            className="block text-sm font-semibold text-slate-300"
          >
            确认密码
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            className="form-input"
            placeholder="再次输入密码"
            value={formData.confirm}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                confirm: event.target.value,
              }))
            }
          />
        </div>

        {errorMsg ? <p className="text-sm text-rose-300">{errorMsg}</p> : null}

        <button
          type="submit"
          className="btn-primary w-full justify-center text-base"
          disabled={submitting}
        >
          {submitting ? "创建中..." : "创建账号"}
        </button>
      </form>

      <p className="text-sm text-slate-400">
        已有账号？{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-300 transition-colors hover:text-blue-200"
        >
          登录
        </Link>
      </p>
    </AuthShell>
  );
}
