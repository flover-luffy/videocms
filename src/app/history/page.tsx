import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) {
    redirect("/login?callbackUrl=/history");
  }

  const payload = await verifyToken(token);
  if (!payload) {
    redirect("/login?callbackUrl=/history");
  }

  return <HistoryClient />;
}
