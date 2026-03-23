"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const navLinks = [
  { name: "首 页", href: "/" },
  { name: "电 影", href: "/library/videos?type=movie" },
  { name: "剧 集", href: "/library/videos?type=tv" },
  { name: "搜 索", href: "/search" },
];

function isLinkActive(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  href: string,
) {
  const [targetPath, query] = href.split("?");
  if (targetPath === "/") return pathname === "/";
  if (pathname !== targetPath) return false;
  if (!query) return true;
  const expectedSearchParams = new URLSearchParams(query);
  return Array.from(expectedSearchParams.entries()).every(
    ([key, value]) => searchParams.get(key) === value,
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const routeKey = `${pathname}?${searchKey}`;
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuRouteKey, setMobileMenuRouteKey] = useState<string | null>(
    null,
  );
  const isMobileMenuOpen = mobileMenuRouteKey === routeKey;
  const activeHref = navLinks.find((link) =>
    isLinkActive(pathname, searchParams, link.href),
  )?.href;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuRouteKey(null);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* 
        This is the new edge-to-edge Netflix style header.
        Transparent by default, transitioning gracefully into solid black/gradient on scroll. 
      */}
      <motion.nav
        aria-label="主导航"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`pointer-events-none fixed top-0 inset-x-0 z-[100] transition-colors duration-500 pt-safe ${
          isScrolled
            ? "bg-[#0C0A09]/95 backdrop-blur-xl border-b border-white/[0.04] shadow-2xl"
            : "bg-gradient-to-b from-[#0C0A09]/80 via-[#0C0A09]/40 to-transparent pt-2 md:pt-4"
        }`}
      >
        <div className="pointer-events-auto flex w-full items-center justify-between px-[4vw] py-4 sm:py-5">
          {/* Logo Section */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-1.5 sm:gap-3 transition-transform hover:scale-105 duration-300"
          >
            <span className="text-[20px] sm:text-[26px] font-black tracking-tighter text-amber-500 drop-shadow-[0_0_12px_rgba(217,119,6,0.6)]">
              ROM&apos;S
            </span>
            <span className="text-[12px] sm:text-[16px] font-semibold tracking-[0.1em] sm:tracking-widest text-slate-100 uppercase mt-0.5 sm:mt-0">
              CINEMA
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden flex-1 pl-12 items-center gap-8 md:flex">
            {navLinks.map((link) => {
              const isActive = activeHref === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative text-xs sm:text-[13.5px] font-bold tracking-[0.15em] uppercase transition-colors duration-300 ${
                    isActive ? "text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="relative z-10">{link.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute -bottom-[1.2rem] left-0 right-0 h-[3px] bg-amber-500 shadow-[0_-2px_8px_rgba(217,119,6,0.5)]"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* User/Mobile Actions */}
          <div className="flex shrink-0 items-center gap-4 sm:gap-6">
            <Link
              href="/profile"
              className="flex items-center gap-2 transition-transform hover:scale-110 duration-200"
            >
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded bg-[#10141f] border border-white/10 flex items-center justify-center overflow-hidden">
                <svg
                  className="h-4 w-4 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            </Link>

            <button
              type="button"
              aria-label="打开导航"
              className="pointer-events-auto text-slate-300 hover:text-white transition-colors md:hidden"
              onClick={() => setMobileMenuRouteKey(routeKey)}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Nav Overlay (Fullscreen Dark) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200] flex flex-col bg-[#0C0A09]/98 p-6 pb-safe pt-safe backdrop-blur-xl md:hidden"
          >
            <div className="mb-12 flex items-center justify-between">
              <span className="text-[22px] font-black tracking-tighter text-amber-500">
                ROM&apos;S
              </span>
              <button
                type="button"
                className="text-slate-400 hover:text-white transition-colors"
                onClick={() => setMobileMenuRouteKey(null)}
              >
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-6 text-center mt-10">
              {navLinks.map((link, index) => {
                const isActive = activeHref === link.href;
                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={link.href}
                      className={`block text-2xl font-black tracking-[0.2em] transition-colors ${
                        isActive
                          ? "text-white"
                          : "text-slate-500 hover:text-white"
                      }`}
                      onClick={() => setMobileMenuRouteKey(null)}
                    >
                      {link.name}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-auto mb-10 text-center">
              <Link
                href="/profile"
                className="inline-block border border-white/20 rounded-full px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-colors"
                onClick={() => setMobileMenuRouteKey(null)}
              >
                访问账户中心
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
