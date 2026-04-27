"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import AuthShell from "@/components/layout/AuthShell";
import { fetchWithCsrf } from "@/lib/fetch-client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.email || !formData.password) {
      setErrorMsg("请输入邮箱和密码。");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const response = await fetchWithCsrf("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (response.ok) {
        const callbackUrl = searchParams.get("callbackUrl");
        const safeCallbackUrl =
          callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
            ? callbackUrl
            : "/";
        router.push(safeCallbackUrl);
      } else {
        setErrorMsg(data.error || "登录失败，请检查邮箱或密码。");
      }
    } catch {
      setErrorMsg("网络请求失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="欢迎回来">
      <form onSubmit={handleLogin} noValidate className="space-y-5">
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
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                email: event.target.value,
              }))
            }
          />
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
            autoComplete="current-password"
            className="form-input"
            placeholder="输入您的账号密码"
            value={formData.password}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                password: event.target.value,
              }))
            }
          />
        </div>

        {errorMsg ? <p className="text-sm text-rose-300">{errorMsg}</p> : null}

        <button
          type="submit"
          className="btn-primary w-full justify-center text-base"
          disabled={loading}
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>

      <div className="flex items-center justify-between gap-4 text-sm text-slate-400">
        <Link
          href="/forgot-password"
          className="font-semibold text-blue-300 transition-colors hover:text-blue-200"
        >
          忘记密码？
        </Link>
        <Link
          href="/register"
          className="font-semibold text-blue-300 transition-colors hover:text-blue-200"
        >
          创建账号
        </Link>
      </div>
    </AuthShell>
  );
}
