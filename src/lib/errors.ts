/**
 * AppError - 自定义错误类
 * 携带HTTP状态码的错误类，用于API错误处理
 *
 * @example
 * throw AppError.notFound("用户不存在");
 * throw AppError.badRequest("参数错误");
 * throw new AppError("自定义错误", 418);
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }

  /**
   * 404 Not Found
   * @param msg - 错误消息
   */
  static notFound(msg: string): AppError {
    return new AppError(msg, 404);
  }

  /**
   * 400 Bad Request
   * @param msg - 错误消息
   */
  static badRequest(msg: string): AppError {
    return new AppError(msg, 400);
  }

  /**
   * 401 Unauthorized
   * @param msg - 错误消息
   */
  static unauthorized(msg: string): AppError {
    return new AppError(msg, 401);
  }

  /**
   * 403 Forbidden
   * @param msg - 错误消息
   */
  static forbidden(msg: string): AppError {
    return new AppError(msg, 403);
  }

  /**
   * 429 Too Many Requests
   * @param msg - 错误消息
   */
  static tooManyRequests(msg: string): AppError {
    return new AppError(msg, 429);
  }

  /**
   * 502 Bad Gateway
   * @param msg - 错误消息
   */
  static badGateway(msg: string): AppError {
    return new AppError(msg, 502);
  }
}
