"use client";

import { useState } from "react";
import PageHero from "@/components/layout/PageHero";
import PageLayout from "@/components/layout/PageLayout";
import SectionHeading from "@/components/layout/SectionHeading";
import ConfigTab from "@/components/admin/ConfigTab";
import ImportTab from "@/components/admin/ImportTab";
import MediaListTab from "@/components/admin/MediaListTab";

type AdminTabId = "import" | "media" | "configs";

const TABS: Array<{
  id: AdminTabId;
  label: string;
}> = [
  {
    id: "import",
    label: "资源导入",
  },
  {
    id: "media",
    label: "媒体控制",
  },
  {
    id: "configs",
    label: "连接配置",
  },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTabId>("import");

  const currentTab = TABS.find((tab) => tab.id === activeTab) || TABS[0];

  return (
    <PageLayout maxWidth="1600px">
      <div className="mx-auto space-y-10 px-4 py-8 sm:space-y-12 sm:px-6 sm:py-12">
        <PageHero
          eyebrow="Admin Console"
          title={
            <>
              管理控制 <span className="text-blue-500 text-gradient">中心</span>
            </>
          }
          description="管理资源导入、媒体维护和连接配置。"
          trailing={
            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/25 px-4 py-4 text-center backdrop-blur-sm">
                <span className="block text-2xl font-black text-white">
                  {TABS.length}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Panels
                </span>
              </div>
              <div className="rounded-[1.5rem] border border-blue-500/20 bg-blue-500/10 px-4 py-4 text-center backdrop-blur-sm">
                <span className="block text-lg font-black text-blue-200">
                  {currentTab.label}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/70">
                  Active
                </span>
              </div>
            </div>
          }
        />

        <section className="space-y-6">
          <SectionHeading title={<>{currentTab.label}</>} />

          <div
            className="flex flex-wrap gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-2 backdrop-blur-md"
            role="tablist"
            aria-label="管理后台功能分区"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`admin-tab-${tab.id}`}
                aria-controls={`admin-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[44px] rounded-[1rem] border px-4 py-3 text-xs font-black uppercase tracking-[0.22em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 sm:px-6 ${activeTab === tab.id ? "border-blue-400/30 bg-blue-500 text-white shadow-[0_12px_36px_rgba(59,130,246,0.24)]" : "border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            id={`admin-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`admin-tab-${activeTab}`}
            className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-4xl backdrop-blur-md sm:rounded-[2.5rem] sm:p-8"
          >
            {activeTab === "import" && <ImportTab />}
            {activeTab === "media" && <MediaListTab />}
            {activeTab === "configs" && <ConfigTab />}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
