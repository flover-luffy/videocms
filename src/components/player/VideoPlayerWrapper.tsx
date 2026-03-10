"use client";

import dynamic from "next/dynamic";

const VideoPlayerWrapper = dynamic(() => import("./VideoPlayer"), {
    ssr: false,
    loading: () => (
        <div
            style={{ aspectRatio: "16/9", background: "#000", borderRadius: "0.75rem" }}
            role="img"
            aria-label="播放器加载中"
        />
    ),
});

export default VideoPlayerWrapper;
