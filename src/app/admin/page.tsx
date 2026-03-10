"use client";
import { useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import ImportTab from "@/components/admin/ImportTab";
import MediaListTab from "@/components/admin/MediaListTab";
import ConfigTab from "@/components/admin/ConfigTab";
import { motion } from "framer-motion";

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState<"import" | "media" | "configs">("import");

    return (
        <PageLayout>
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <h1 className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tighter italic uppercase">
                            管理控制<span className="text-blue-500">中心</span>
                        </h1>
                        <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                            管理中心与资源看板 · Admin Console
                        </p>
                    </motion.div>
                </div>

                {/* Tabs - Advanced Glass Design */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex p-1.5 rounded-[1.5rem] bg-white/5 border border-white/5 backdrop-blur-3xl w-fit mb-10 overflow-hidden"
                    role="tablist"
                    aria-label="管理后台控制项"
                >
                    {[
                        { id: "import", label: "资源导入" },
                        { id: "media", label: "媒体控制" },
                        { id: "configs", label: "连接配置" }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={`relative px-8 py-3 rounded-[1.25rem] text-sm font-black transition-all duration-500 uppercase tracking-widest ${activeTab === tab.id
                                ? "text-white"
                                : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="admin-tab-active"
                                    className="absolute inset-0 bg-blue-600 shadow-2xl shadow-blue-500/40"
                                    style={{ borderRadius: "1.25rem" }}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className="relative z-10">{tab.label}</span>
                        </button>
                    ))}
                </motion.div>

                {/* Content Area */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="glass rounded-[2.5rem] p-8 min-h-[500px] border-white/5"
                >
                    {activeTab === "import" && <ImportTab />}
                    {activeTab === "media" && <MediaListTab />}
                    {activeTab === "configs" && <ConfigTab />}
                </motion.div>
            </div>
        </PageLayout>
    );
}
