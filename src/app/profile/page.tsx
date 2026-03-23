import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) {
    redirect("/login?callbackUrl=/profile");
  }

  const payload = await verifyToken(token);
  if (!payload) {
    redirect("/login?callbackUrl=/profile");
  }

  return <ProfileClient />;
}
