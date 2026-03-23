"use client";

import dynamic from "next/dynamic";

const VideoPlayerWrapper = dynamic(() => import("./VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div
      className="flex aspect-video items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/70 sm:rounded-[2rem]"
      role="img"
      aria-label="播放器加载中"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-amber-400" />
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
          播放器加载中
        </p>
      </div>
    </div>
  ),
});

export default VideoPlayerWrapper;
