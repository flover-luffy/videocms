"use client";

import React, { ReactNode } from "react";
import Navbar from "./Navbar";
import { motion } from "framer-motion";

interface PageLayoutProps {
    children: ReactNode;
    className?: string;
    maxWidth?: string;
    immersive?: boolean;
}

export default function PageLayout({ children, className = "", maxWidth = "1600px", immersive = false }: PageLayoutProps) {
    return (
        <div className="min-h-screen text-[#050505] dark:text-[#f8fafc] relative selection:bg-blue-500/30">
            {/* 动态极光流体背景层 */}
            <div className="aura-background" />

            <Navbar />

            <motion.main
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
                className={`${immersive ? 'pt-0' : 'pt-32'} pb-20 px-6 sm:px-10 mx-auto ${className}`}
                style={{ maxWidth }}
            >
                {children}
            </motion.main>

            <footer className="py-12 border-t border-white/5 bg-[#05070a]">
                <div className="max-w-[1600px] mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                            <span className="text-white font-black text-sm italic">R</span>
                        </div>
                        <span className="text-xl font-black text-white italic">Rom&apos;s Cinema</span>
                    </div>
                    <p className="text-slate-500 text-sm font-bold">Copyright © 2026 Rom&apos;s Cinema All Rights Reserved.</p>
                </div>
            </footer>
        </div>
    );
}
