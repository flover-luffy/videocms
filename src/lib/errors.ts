/**
 * AppError: 携带 HTTP 状态码的自定义错误类
 * 替代在 api-handler.ts 中通过字符串关键字推导状态码的脆弱逻辑
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }

  /** 快捷工厂方法 */
  static notFound(msg: string) {
    return new AppError(msg, 404);
  }
  static badRequest(msg: string) {
    return new AppError(msg, 400);
  }
  static unauthorized(msg: string) {
    return new AppError(msg, 401);
  }
  static forbidden(msg: string) {
    return new AppError(msg, 403);
  }
  static tooManyRequests(msg: string) {
    return new AppError(msg, 429);
  }
  static badGateway(msg: string) {
    return new AppError(msg, 502);
  }
}
