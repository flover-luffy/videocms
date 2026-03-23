"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Navbar from "./Navbar";

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: string; // Kept for API compat, but functionally overridden
  immersive?: boolean;
}

export default function PageLayout({
  children,
  className = "",
  immersive = true,
}: PageLayoutProps) {
  return (
    <div className="relative min-h-screen text-[#050505] selection:bg-amber-500/30 dark:text-[#f8fafc] w-full overflow-x-hidden">
      <div className="aura-background" />

      <Navbar />

      <motion.main
        id="main-content"
        role="main"
        tabIndex={-1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        // Cinematic baseline: no horizontal padding on the wrapper, individual rows handle their own side paddings (e.g. px-[4vw])
        className={`relative w-full z-10 ${immersive ? "pt-0" : "pt-[80px] sm:pt-[100px]"} ${className}`}
      >
        {children}
      </motion.main>

      <footer className="border-t border-white/5 bg-transparent pt-16 pb-12 mt-20 relative z-20">
        <div className="mx-auto flex w-full px-[4vw] flex-col items-center justify-between gap-8 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-600">
              <span className="text-sm font-black italic text-white">R</span>
            </div>
            <span className="text-lg font-black italic text-white/90 tracking-wider">
              Rom&apos;s Cinema
            </span>
          </div>

          <p className="text-center text-xs font-semibold text-slate-500 md:text-right">
            Copyright (c) 2026 Rom&apos;s Cinema All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
