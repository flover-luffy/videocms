import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { verifyToken } from "@/lib/auth/jwt";
import type { JwtPayload } from "@/types";

export async function requireUser(request: NextRequest): Promise<JwtPayload> {
  const token =
    request.cookies.get("access_token")?.value ||
    request.headers.get("Authorization")?.split(" ")[1];

  if (!token) {
    throw AppError.unauthorized("Unauthorized");
  }

  const payload = await verifyToken(token);
  if (!payload) {
    throw AppError.unauthorized("Invalid or expired token");
  }

  return payload;
}

export async function requireAdmin(request: NextRequest): Promise<JwtPayload> {
  const payload = await requireUser(request);
  if (payload.role !== "admin") {
    throw AppError.forbidden("Insufficient permissions");
  }
  return payload;
}
