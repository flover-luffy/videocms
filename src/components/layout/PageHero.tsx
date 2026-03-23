"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface PageHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export default function PageHero({
  eyebrow,
  title,
  description,
  leading,
  trailing,
  footer,
  align = "left",
  className = "",
}: PageHeroProps) {
  const centered = align === "center";

  return (
    <motion.header
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden w-full flex flex-col justify-center bg-[#000000] px-[4vw] py-16 sm:py-24 md:py-32 ${className}`}
    >
      {/* 更加纯粹微弱的光影 */}
      <div className="absolute top-0 right-0 w-[60vw] h-[60vh] bg-amber-600/3 blur-[150px] rounded-full pointer-events-none" />

      <div
        className={`relative z-10 flex flex-col gap-8 ${trailing ? "xl:flex-row xl:items-end xl:justify-between" : ""}`}
      >
        <div
          className={`space-y-6 ${centered ? "mx-auto text-center" : "max-w-5xl"}`}
        >
          {leading}
          {eyebrow && (
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500/80">
              {eyebrow}
            </p>
          )}
          <div className="space-y-4">
            <h1 className="font-outfit text-4xl font-black tracking-tighter text-white sm:text-6xl lg:text-[5rem] xl:text-[6rem] drop-shadow-2xl leading-[1.05]">
              {title}
            </h1>
            {description && (
              <p
                className={`text-sm font-medium leading-relaxed text-slate-400 sm:text-lg ${centered ? "mx-auto max-w-3xl" : "max-w-3xl"}`}
              >
                {description}
              </p>
            )}
          </div>
        </div>

        {trailing && (
          <div
            className={`relative z-10 shrink-0 ${centered ? "mx-auto" : ""}`}
          >
            {trailing}
          </div>
        )}
      </div>

      {footer && (
        <div
          className={`relative z-10 mt-12 ${centered ? "mx-auto w-full max-w-4xl" : ""}`}
        >
          {footer}
        </div>
      )}
    </motion.header>
  );
}
