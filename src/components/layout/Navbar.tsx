"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
    const pathname = usePathname();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { name: "首页", href: "/" },
        { name: "电影", href: "/library/videos?type=movie" },
        { name: "电视剧", href: "/library/videos?type=tv" },
        { name: "搜索", href: "/search" },
    ];

    return (
        <>
            <motion.nav
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
            >
                <div
                    className={`pointer-events-auto flex items-center transition-all duration-700 ease-[var(--ease-smooth)] ${isScrolled
                        ? "w-max max-w-full justify-between gap-6 md:gap-12 px-6 py-3 aura-glass rounded-full shadow-[0_10px_40px_#00000066]"
                        : "w-full max-w-7xl justify-between px-8 py-5 border-transparent bg-transparent"
                        }`}
                >
                    <Link href="/" className="flex items-center gap-3 group relative z-50 shrink-0">
                        {/* Logo 徽标 - 深邃光效 */}
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_#6366f166] group-hover:scale-110 transition-transform duration-500 ease-[var(--ease-spring)] shrink-0">
                            <span className="text-white font-black text-lg tracking-tighter shadow-sm">R</span>
                        </div>
                        <span className={`font-black tracking-tight whitespace-nowrap transition-all duration-500 ${isScrolled ? "text-xl text-white hidden lg:block" : "text-2xl text-white"}`}>
                            Rom&apos;s <span className="text-blue-400">Cinema</span>
                        </span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-2">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`relative px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 ${isActive
                                        ? "text-white"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="nav-indicator"
                                            className="absolute inset-0 bg-white/10 rounded-full border border-white/20"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <span className="relative z-10">{link.name}</span>
                                </Link>
                            )
                        })}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                        <Link href="/profile" className={`flex items-center justify-center rounded-full transition-all duration-300 hover:bg-white/10 ${isScrolled ? "w-10 h-10 bg-white/5" : "btn-pill !px-6 !py-2.5"}`}>
                            {isScrolled ? (
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            ) : (
                                "账户"
                            )}
                        </Link>
                        <button className="md:hidden w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white" onClick={() => setIsMobileMenuOpen(true)}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>
                </div>
            </motion.nav>

            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed inset-0 z-[110] aura-glass p-8 flex flex-col md:hidden bg-[#0A0B10]/90"
                    >
                        <div className="flex justify-end mb-12">
                            <button onClick={() => setIsMobileMenuOpen(false)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex flex-col gap-6">
                            {navLinks.map((link) => (
                                <Link key={link.href} href={link.href} className="text-3xl font-black text-white px-4 py-3 rounded-2xl hover:bg-white/10 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
