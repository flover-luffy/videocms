import type { Metadata } from "next";
import "./globals.css";
import SentryInitializer from "@/components/monitoring/SentryInitializer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Rom's Cinema — 私人影音收藏",
    template: "%s | Rom's Cinema",
  },
  description: "您的私人影视管理中心，影院级播放体验，自动元数据富化",
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
    <html lang="zh-CN" suppressHydrationWarning className="dark">
      <body className="antialiased">
        <SentryInitializer />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
