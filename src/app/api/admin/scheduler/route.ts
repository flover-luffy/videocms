import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-auth";
import { withApiHandler } from "@/lib/api-handler";
import { getSchedulerStatus, triggerManualScan } from "@/lib/scheduler";

/**
 * GET /api/admin/scheduler
 * 查询 Scheduler 运行状态（管理员专用）
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);

  const status = getSchedulerStatus();

  return NextResponse.json({
    success: true,
    data: status,
  });
});

/**
 * POST /api/admin/scheduler
 * 手动触发一次全量扫描（管理员专用）
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);

  const result = await triggerManualScan();

  return NextResponse.json({
    success: result.triggered,
    message: result.message,
  });
});
