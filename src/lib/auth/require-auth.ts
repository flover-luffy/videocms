import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { verifyToken } from "@/lib/auth/jwt";
import { getRequestAuthToken } from "@/lib/auth/request-token";
import type { JwtPayload } from "@/types";

export async function requireUser(request: NextRequest): Promise<JwtPayload> {
  const token = getRequestAuthToken(request);

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
