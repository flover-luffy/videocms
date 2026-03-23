"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface PlaySynopsisProps {
  overview?: string;
  tagline?: string;
}

/** 长文本阈值（字符数），超过时启用"展开/收起"交互 */
const LONG_TEXT_THRESHOLD = 180;

export default function PlaySynopsis({ overview, tagline }: PlaySynopsisProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayText = overview || "暂无这部内容的详细介绍。";
  const isLongDescription = displayText.length > LONG_TEXT_THRESHOLD;

  return (
    <div>
      {/* 引言 */}
      {tagline && (
        <div className="text-lg italic font-medium text-white/50 mb-3 blockquote-clean">
          &ldquo;{tagline}&rdquo;
        </div>
      )}

      {/* 剧情概要（可展开/收起） */}
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? "auto" : "90px" }}
        className="relative overflow-hidden"
      >
        <p className="text-[15px] sm:text-base leading-relaxed text-slate-300">
          {displayText}
        </p>
        {!isExpanded && isLongDescription && (
          <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-[#030407] to-transparent pointer-events-none" />
        )}
      </motion.div>

      {isLongDescription && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs font-bold text-white hover:text-amber-400 transition-colors uppercase tracking-widest"
        >
          {isExpanded ? "收起" : "阅读更多"}
        </button>
      )}
    </div>
  );
}
