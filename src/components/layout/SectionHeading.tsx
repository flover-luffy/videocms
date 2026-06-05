"use client";

import { ReactNode, memo } from "react";

interface SectionHeadingProps {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}

function SectionHeading({
  title,
  action,
  className = "",
}: SectionHeadingProps) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div>
        <h2 className="flex items-center gap-3 text-xl font-black tracking-tighter text-white sm:text-2xl">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>{title}</span>
        </h2>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default memo(SectionHeading);
