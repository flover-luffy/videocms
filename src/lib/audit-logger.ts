import { Prisma } from "@prisma/client";
import { prisma } from "./db";

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
    /**
     * 记录审计日志
     */
    static async log(entry: AuditLogEntry): Promise<void> {
        try {
            // 持久化到数据库
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
                }
            });

            // 开发环境保留 console 输出
            if (process.env.NODE_ENV === "development") {
                console.log(`[AUDIT] ${entry.action}`, {
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
            // 审计日志失败不应影响主流程，但需要记录错误
            console.error("[AUDIT] 日志记录失败:", err);
        }
    }

    /**
     * 记录登录尝试
     */
    static async logLoginAttempt(
        email: string,
        ipAddress: string,
        success: boolean,
        errorMessage?: string
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
        errorMessage?: string
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
        userId?: number
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
