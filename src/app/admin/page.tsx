import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) {
    redirect("/login?callbackUrl=/admin");
  }

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") {
    redirect("/login?callbackUrl=/admin");
  }

  return <AdminClient />;
}
