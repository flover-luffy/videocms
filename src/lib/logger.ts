/**
 * 统一日志工具
 * 生产环境自动禁用debug和info级别日志
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * 错误日志 - 始终输出
   */
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },

  /**
   * 警告日志 - 始终输出
   */
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * 信息日志 - 生产环境禁用
   */
  info: (message: string, ...args: unknown[]) => {
    if (!IS_PRODUCTION) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * 调试日志 - 生产环境禁用
   */
  debug: (message: string, ...args: unknown[]) => {
    if (IS_DEVELOPMENT) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * 性能日志 - 生产环境禁用
   */
  perf: (label: string, fn: () => void) => {
    if (IS_DEVELOPMENT) {
      console.time(label);
      fn();
      console.timeEnd(label);
    } else {
      fn();
    }
  },
};

export default logger;
