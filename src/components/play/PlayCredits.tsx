"use client";

import { memo } from "react";

interface PlayCreditsProps {
  directors?: string[];
  cast: string[];
}

function PlayCredits({ directors, cast }: PlayCreditsProps) {
  const hasDirectors = directors && directors.length > 0;
  const hasCast = cast.length > 0;

  if (!hasDirectors && !hasCast) {
    return null;
  }

  return (
    <div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {hasDirectors && (
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              主创团队
            </h3>
            <p className="text-sm text-slate-300">{directors.join(" · ")}</p>
          </div>
        )}
        {hasCast && (
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              领衔主演
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              {cast.slice(0, 10).join(" · ")}
              {cast.length > 10 ? " ..." : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PlayCredits);
