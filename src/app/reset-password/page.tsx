"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/layout/AuthShell";
import { fetchWithCsrf } from "@/lib/fetch-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const passwordRules = [
    { label: "至少 12 个字符", valid: password.length >= 12 },
    { label: "包含大写字母", valid: /[A-Z]/.test(password) },
    { label: "包含数字", valid: /[0-9]/.test(password) },
    { label: "包含特殊字符 (!@#$%^&*)", valid: /[!@#$%^&*]/.test(password) },
  ];
  const isPasswordValid = passwordRules.every((rule) => rule.valid);

  useEffect(() => {
    if (!token) {
      setErrorMsg("无效的重置链接，请重新发起找回密码流程。");
    }
  }, [token]);

  useEffect(() => {
    if (!successMsg) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      router.push("/login");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [router, successMsg]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setErrorMsg("无效的重置链接，请重新发起找回密码流程。");
      return;
    }

    if (!password || !confirmPassword) {
      setErrorMsg("请完整填写新密码。");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("两次输入的密码不一致。");
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg("密码未满足安全要求，请先修正。");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await fetchWithCsrf("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg(data.message || "密码重置成功，即将返回登录页。");
      } else {
        setErrorMsg(data.error || "重置失败，请稍后重试。");
      }
    } catch {
      setErrorMsg("网络请求失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="设置新密码">
      {successMsg ? (
        <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-500/10 p-5">
          <p className="text-sm font-semibold text-emerald-300">{successMsg}</p>
          <p className="mt-2 text-sm text-slate-400">
            页面会在 3 秒后自动跳转到登录页。
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-300"
            >
              新密码
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              className="form-input"
              placeholder="输入新密码"
              value={password}
              disabled={!token}
              onChange={(event) => setPassword(event.target.value)}
            />

            {password ? (
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
              htmlFor="confirmPassword"
              className="block text-sm font-semibold text-slate-300"
            >
              确认密码
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              className="form-input"
              placeholder="再次输入新密码"
              value={confirmPassword}
              disabled={!token}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          {errorMsg ? (
            <p className="text-sm text-rose-300">{errorMsg}</p>
          ) : null}

          <button
            type="submit"
            className="btn-primary w-full justify-center text-base"
            disabled={loading || !token}
          >
            {loading ? "重置中..." : "确认重置密码"}
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="text-sm font-semibold text-blue-300 transition-colors hover:text-blue-200"
      >
        返回登录
      </Link>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6 text-sm text-slate-400">
          正在加载重置流程...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
