"use client";

import Link from "next/link";
import { memo } from "react";

interface PlayBreadcrumbProps {
  seriesId: number;
  seriesTitle: string;
  episodeNum: number;
}

function PlayBreadcrumb({
  seriesId,
  seriesTitle,
  episodeNum,
}: PlayBreadcrumbProps) {
  return (
    <nav
      aria-label="面包屑导航"
      className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500"
    >
      <Link href="/" className="hover:text-white transition-colors">
        首页
      </Link>
      <span className="opacity-30">/</span>
      <Link
        href={`/series/${seriesId}`}
        className="hover:text-white transition-colors max-w-[120px] truncate sm:max-w-none"
      >
        {seriesTitle}
      </Link>
      <span className="opacity-30">/</span>
      <span className="text-white">第 {episodeNum} 集</span>
    </nav>
  );
}

export default memo(PlayBreadcrumb);
