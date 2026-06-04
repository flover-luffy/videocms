/**
 * 统一错误响应格式
 * 标准化所有API的错误响应
 */

import { NextResponse } from "next/server";
import { HTTP_STATUS } from "./constants";

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp?: string;
}

/**
 * 创建标准化的错误响应
 */
export function errorResponse(
  message: string,
  status: number = HTTP_STATUS.INTERNAL_ERROR,
  code?: string,
  details?: unknown
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: message,
      code,
      details,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * 创建标准化的成功响应
 */
export function successResponse<T>(
  data: T,
  status: number = HTTP_STATUS.OK
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * 常见错误响应快捷方法
 */
export const ApiError = {
  badRequest: (message: string, details?: unknown) =>
    errorResponse(message, HTTP_STATUS.BAD_REQUEST, "BAD_REQUEST", details),

  unauthorized: (message: string = "未授权访问") =>
    errorResponse(message, HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED"),

  forbidden: (message: string = "访问被禁止") =>
    errorResponse(message, HTTP_STATUS.FORBIDDEN, "FORBIDDEN"),

  notFound: (message: string = "资源不存在") =>
    errorResponse(message, HTTP_STATUS.NOT_FOUND, "NOT_FOUND"),

  conflict: (message: string, details?: unknown) =>
    errorResponse(message, HTTP_STATUS.CONFLICT, "CONFLICT", details),

  tooManyRequests: (message: string = "请求过于频繁", retryAfter?: number) => {
    const response = errorResponse(
      message,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      "TOO_MANY_REQUESTS"
    );
    if (retryAfter) {
      response.headers.set("Retry-After", retryAfter.toString());
    }
    return response;
  },

  internal: (message: string = "服务器内部错误") =>
    errorResponse(message, HTTP_STATUS.INTERNAL_ERROR, "INTERNAL_ERROR"),

  serviceUnavailable: (message: string = "服务暂时不可用") =>
    errorResponse(message, HTTP_STATUS.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE"),
};

/**
 * 验证请求体
 */
export async function validateRequest<T>(
  request: Request,
  schema: { parse: (data: unknown) => T }
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: ApiError.badRequest("请求参数验证失败", error),
    };
  }
}
