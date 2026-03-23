/**
 * 资源导入 API
 * POST /api/admin/import
 *
 * 接收 OpenList 目录 URL，递归扫描并将媒体文件分流导入
 * 支持可选的幂等性防护（通过 Idempotency-Key 请求头）
 */
import { NextRequest, NextResponse } from "next/server";
import { runImportTask } from "@/lib/import-task";
import { withApiHandler } from "@/lib/api-handler";
import { isImporting, setImporting } from "@/lib/scheduler";
import { ImportSchema } from "@/lib/validation";
import { API_TIMEOUT_CONFIG } from "@/config";
import { requireAdmin } from "@/lib/auth/require-auth";
import { enforceIdempotency } from "@/lib/idempotency";

export const POST = withApiHandler(
  async (request: NextRequest) => {
    await requireAdmin(request);

    // 幂等性防护：如果前端传了 Idempotency-Key 则启用，否则正常通过
    return enforceIdempotency(request, async () => {
      const json = await request.json().catch(() => null);
      const result = ImportSchema.safeParse(json);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error.issues[0]?.message ?? "请求参数无效" },
          { status: 400 },
        );
      }
      const { configId, path, title } = result.data;

      if (isImporting()) {
        return NextResponse.json(
          { error: "由于后台正在执行定时扫描或其它任务，请稍后再试" },
          { status: 429 },
        );
      }

      setImporting(true);
      try {
        const importResult = await runImportTask(configId, path, title);
        return NextResponse.json(importResult);
      } finally {
        setImporting(false);
      }
    });
  },
  { timeout: API_TIMEOUT_CONFIG.IMPORT },
);
