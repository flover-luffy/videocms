import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

import { Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Rom's Cinema | 私人影视收藏",
    template: "%s | Rom's Cinema",
  },
  description: "您的私人影视管理中心，提供影院级播放体验与自动元数据整理。",
  keywords: ["私人影院", "影视管理", "媒体库", "Rom's Cinema", "在线播放"],
  openGraph: {
    title: "Rom's Cinema",
    description: "您的私人影视管理中心",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`dark ${dmSans.variable} ${outfit.variable}`}
    >
      <body className="antialiased font-sans">
        <a href="#main-content" className="skip-link">
          跳到主要内容
        </a>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
