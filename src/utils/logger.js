/**
 * 日志工具类
 */
class Logger {
  constructor() {
    this.isDebug = process.argv.includes('--dev');
  }

  /**
   * 信息日志
   * @param {string} message 日志消息
   * @param {any} data 附加数据
   */
  info(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${message}`);
    if (data) {
      console.log(data);
    }
  }

  /**
   * 警告日志
   * @param {string} message 日志消息
   * @param {any} data 附加数据
   */
  warn(message, data = null) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${message}`);
    if (data) {
      console.warn(data);
    }
  }

  /**
   * 错误日志
   * @param {string} message 日志消息
   * @param {Error} error 错误对象
   */
  error(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`);
    if (error) {
      console.error(error);
      if (error.stack) {
        console.error(error.stack);
      }
    }
  }

  /**
   * 调试日志
   * @param {string} message 日志消息
   * @param {any} data 附加数据
   */
  debug(message, data = null) {
    if (this.isDebug) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [DEBUG] ${message}`);
      if (data) {
        console.log(data);
      }
    }
  }

  /**
   * 性能日志
   * @param {string} operation 操作名称
   * @param {number} startTime 开始时间
   */
  performance(operation, startTime) {
    const duration = Date.now() - startTime;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PERF] ${operation} took ${duration}ms`);
  }
}

// 创建全局日志实例
const logger = new Logger();

module.exports = {
  Logger,
  logger
}; 