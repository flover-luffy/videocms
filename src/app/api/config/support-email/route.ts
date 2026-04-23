import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    email: process.env.ADMIN_EMAIL || "",
  });
}
