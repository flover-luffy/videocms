import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { withRetry } from "./retry-utils";
import fs from "fs/promises";
import path from "path";

/**
 * 审计日志类型
 */
enum AuditAction {
  // 用户操作
  USER_LOGIN = "USER_LOGIN",
  USER_LOGOUT = "USER_LOGOUT",
  USER_REGISTER = "USER_REGISTER",

  // 管理员操作
  ADMIN_IMPORT_MEDIA = "ADMIN_IMPORT_MEDIA",
  ADMIN_DELETE_SERIES = "ADMIN_DELETE_SERIES",
  ADMIN_UPDATE_CONFIG = "ADMIN_UPDATE_CONFIG",

  // 安全事件
  FAILED_LOGIN = "FAILED_LOGIN",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  INVALID_INPUT = "INVALID_INPUT",
}

/**
 * 审计日志条目
 */
interface AuditLogEntry {
  action: AuditAction;
  userId?: number;
  userEmail?: string;
  ipAddress: string;
  resourceType?: string;
  resourceId?: number;
  details?: Record<string, unknown>;
  status: "success" | "failure";
  errorMessage?: string;
}

/**
 * 审计日志记录器
 */
export class AuditLogger {
  private static readonly auditLogDir = "/tmp/audit-logs";
  private static readonly retryConfig = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 1000,
  };

  /**
   * 确保审计日志目录存在
   */
  private static async ensureAuditDir(): Promise<void> {
    try {
      await fs.mkdir(this.auditLogDir, { recursive: true });
    } catch (err) {
      console.error("[AUDIT] 无法创建日志目录:", err);
    }
  }

  /**
   * 备份到本地文件（降级方案）
   */
  private static async fallbackToFile(entry: AuditLogEntry): Promise<void> {
    try {
      await this.ensureAuditDir();
      const timestamp = new Date().toISOString();
      const filename = `audit-log-${new Date().toISOString().split("T")[0]}.log`;
      const filepath = path.join(this.auditLogDir, filename);

      const logLine =
        JSON.stringify({
          timestamp,
          ...entry,
        }) + "\n";

      await fs.appendFile(filepath, logLine, "utf-8");
      console.warn("[AUDIT FALLBACK] 已记录到本地文件:", filepath);
    } catch (err) {
      console.error("[AUDIT FALLBACK] 文件写入失败:", err);
    }
  }

  /**
   * 记录审计日志
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      // 尝试持久化到数据库，支持重试
      await withRetry(async () => {
        await prisma.auditLog.create({
          data: {
            action: entry.action,
            userId: entry.userId,
            userEmail: entry.userEmail,
            ipAddress: entry.ipAddress,
            resourceType: entry.resourceType,
            resourceId: entry.resourceId,
            details: (entry.details as Prisma.InputJsonValue) ?? undefined,
            status: entry.status,
            errorMessage: entry.errorMessage,
          },
        });
      }, this.retryConfig);

      // 开发环境保留 console 输出
      if (process.env.NODE_ENV === "development") {
        console.info(`[AUDIT] ${entry.action}`, {
          timestamp: new Date().toISOString(),
          userId: entry.userId,
          userEmail: entry.userEmail,
          ipAddress: entry.ipAddress,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          status: entry.status,
          errorMessage: entry.errorMessage,
          details: entry.details,
        });
      }
    } catch (err) {
      // 数据库失败，降级到文件
      console.error("[AUDIT] 数据库写入失败，降级到文件存储:", err);
      await this.fallbackToFile(entry);
    }
  }

  /**
   * 记录登录尝试
   */
  static async logLoginAttempt(
    email: string,
    ipAddress: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    await this.log({
      action: success ? AuditAction.USER_LOGIN : AuditAction.FAILED_LOGIN,
      userEmail: email,
      ipAddress,
      status: success ? "success" : "failure",
      errorMessage,
    });
  }

  /**
   * 记录管理员操作
   */
  static async logAdminAction(
    action: AuditAction,
    userId: number,
    ipAddress: string,
    resourceType: string,
    resourceId?: number,
    details?: Record<string, unknown>,
    success: boolean = true,
    errorMessage?: string,
  ): Promise<void> {
    await this.log({
      action,
      userId,
      ipAddress,
      resourceType,
      resourceId,
      details,
      status: success ? "success" : "failure",
      errorMessage,
    });
  }

  /**
   * 记录未授权访问
   */
  static async logUnauthorizedAccess(
    ipAddress: string,
    resourcePath: string,
    userId?: number,
  ): Promise<void> {
    await this.log({
      action: AuditAction.UNAUTHORIZED_ACCESS,
      userId,
      ipAddress,
      resourceType: "endpoint",
      details: { path: resourcePath },
      status: "failure",
    });
  }
}
