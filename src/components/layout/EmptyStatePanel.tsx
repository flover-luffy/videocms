"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface EmptyStatePanelProps {
  title: ReactNode;
  description?: ReactNode;
  actionHref?: string;
  actionLabel?: ReactNode;
  className?: string;
}

export default function EmptyStatePanel({
  title,
  description,
  actionHref,
  actionLabel,
  className = "",
}: EmptyStatePanelProps) {
  return (
    <div
      className={`rounded-[2rem] bg-white/[0.01] px-6 py-20 text-center sm:px-10 sm:py-28 ${className}`}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <h3 className="font-outfit text-2xl font-black tracking-tighter text-white sm:text-4xl">
          {title}
        </h3>
        {description && (
          <p className="text-sm font-medium leading-relaxed text-slate-400 sm:text-base">
            {description}
          </p>
        )}
        {actionHref && actionLabel && (
          <div className="pt-6">
            <Link
              href={actionHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-black text-black transition-all hover:scale-105 active:scale-95 shadow-[0_4px_14px_rgba(255,255,255,0.15)]"
            >
              {actionLabel}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
