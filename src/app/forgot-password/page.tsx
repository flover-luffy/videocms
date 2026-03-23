"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import AuthShell from "@/components/layout/AuthShell";
import { fetchWithCsrf } from "@/lib/fetch-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setErrorMsg("请输入有效的邮箱地址。");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await fetchWithCsrf("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg(data.message || "重置链接已发送到您的邮箱。");
        setEmail("");
      } else {
        setErrorMsg(data.error || "发送失败，请稍后重试。");
      }
    } catch {
      setErrorMsg("网络请求失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="发送重置链接">
      {successMsg ? (
        <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-500/10 p-5">
          <p className="text-sm font-semibold text-emerald-300">{successMsg}</p>
          <p className="mt-2 text-sm text-slate-400">
            请检查收件箱和垃圾邮件文件夹，邮件通常会在几分钟内到达。
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {errorMsg ? (
            <p className="text-sm text-rose-300">{errorMsg}</p>
          ) : null}

          <button
            type="submit"
            className="btn-primary w-full justify-center text-base"
            disabled={loading}
          >
            {loading ? "发送中..." : "发送重置链接"}
          </button>
        </form>
      )}

      <div className="flex items-center justify-between gap-4 text-sm text-slate-400">
        <Link
          href="/login"
          className="font-semibold text-blue-300 transition-colors hover:text-blue-200"
        >
          返回登录
        </Link>
        <Link
          href="/register"
          className="font-semibold text-blue-300 transition-colors hover:text-blue-200"
        >
          注册账号
        </Link>
      </div>
    </AuthShell>
  );
}
