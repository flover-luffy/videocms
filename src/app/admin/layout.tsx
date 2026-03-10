import Navbar from "@/components/layout/Navbar";

export const metadata = {
    title: "管理后台 | Rom's Cinema",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Navbar />
            {children}
        </>
    );
}
