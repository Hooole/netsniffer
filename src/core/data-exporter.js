const fs = require('fs-extra');
const path = require('path');
const { formatTimestamp } = require('../utils/helpers');

/**
 * 数据导出器
 */
class DataExporter {
  constructor() {}

  /**
   * 导出数据到文件
   * @param {Array} data 要导出的数据
   * @param {string} filePath 文件路径
   * @param {string} format 导出格式 (json|csv)
   * @returns {Promise<void>}
   */
  async exportData(data, filePath, format = 'json') {
    try {
      // 确保目录存在
      const dir = path.dirname(filePath);
      await fs.ensureDir(dir);

      if (format === 'json') {
        await this.exportToJson(data, filePath);
      } else if (format === 'csv') {
        await this.exportToCsv(data, filePath);
      } else {
        throw new Error(`不支持的导出格式: ${format}`);
      }
    } catch (error) {
      throw new Error(`导出数据失败: ${error.message}`);
    }
  }

  /**
   * 导出为JSON格式
   * @param {Array} data 数据
   * @param {string} filePath 文件路径
   * @returns {Promise<void>}
   */
  async exportToJson(data, filePath) {
    const exportData = {
      exportTime: new Date().toISOString(),
      totalCount: data.length,
      data: data.map(item => this.sanitizeDataItem(item))
    };

    await fs.writeJson(filePath, exportData, { spaces: 2 });
  }

  /**
   * 导出为CSV格式
   * @param {Array} data 数据
   * @param {string} filePath 文件路径
   * @returns {Promise<void>}
   */
  async exportToCsv(data, filePath) {
    if (data.length === 0) {
      await fs.writeFile(filePath, '');
      return;
    }

    // 定义CSV列
    const columns = [
      '时间戳',
      '方法',
      'URL',
      '主机',
      '协议',
      '状态码',
      '请求头数量',
      '响应头数量',
      '请求体大小',
      '响应体大小'
    ];

    // 生成CSV内容
    const csvLines = [];
    
    // 添加表头
    csvLines.push(columns.join(','));
    
    // 添加数据行
    data.forEach(item => {
      const row = [
        `"${formatTimestamp(item.timestamp)}"`,
        `"${item.method || ''}"`,
        `"${item.url || ''}"`,
        `"${item.host || ''}"`,
        `"${item.protocol || ''}"`,
        item.statusCode || '',
        Object.keys(item.headers || {}).length,
        Object.keys(item.responseHeaders || {}).length,
        this.getBodySize(item.requestBody),
        this.getBodySize(item.responseBody)
      ];
      csvLines.push(row.join(','));
    });

    await fs.writeFile(filePath, csvLines.join('\n'), 'utf8');
  }

  /**
   * 清理数据项，移除不可序列化的内容
   * @param {Object} item 数据项
   * @returns {Object} 清理后的数据项
   */
  sanitizeDataItem(item) {
    return {
      timestamp: item.timestamp,
      method: item.method,
      url: item.url,
      host: item.host,
      protocol: item.protocol,
      statusCode: item.statusCode,
      headers: this.sanitizeHeaders(item.headers),
      responseHeaders: this.sanitizeHeaders(item.responseHeaders),
      requestBody: this.sanitizeBody(item.requestBody),
      responseBody: this.sanitizeBody(item.responseBody)
    };
  }

  /**
   * 清理请求/响应头
   * @param {Object} headers 头部信息
   * @returns {Object} 清理后的头部信息
   */
  sanitizeHeaders(headers) {
    if (!headers || typeof headers !== 'object') {
      return {};
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(headers)) {
      if (typeof key === 'string' && typeof value === 'string') {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * 清理请求/响应体
   * @param {any} body 请求/响应体
   * @returns {string} 清理后的内容
   */
  sanitizeBody(body) {
    if (!body) {
      return '';
    }

    if (typeof body === 'string') {
      return body;
    }

    if (Buffer.isBuffer(body)) {
      return body.toString('utf8');
    }

    if (typeof body === 'object') {
      try {
        return JSON.stringify(body);
      } catch {
        return '[Object]';
      }
    }

    return String(body);
  }

  /**
   * 获取请求/响应体大小
   * @param {any} body 请求/响应体
   * @returns {number} 大小（字节）
   */
  getBodySize(body) {
    if (!body) {
      return 0;
    }

    if (typeof body === 'string') {
      return Buffer.byteLength(body, 'utf8');
    }

    if (Buffer.isBuffer(body)) {
      return body.length;
    }

    if (typeof body === 'object') {
      try {
        return Buffer.byteLength(JSON.stringify(body), 'utf8');
      } catch {
        return 0;
      }
    }

    return Buffer.byteLength(String(body), 'utf8');
  }

  /**
   * 生成导出文件名
   * @param {string} format 文件格式
   * @param {string} prefix 文件名前缀
   * @returns {string} 文件名
   */
  generateFileName(format, prefix = 'capture-data') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${timestamp}.${format}`;
  }
}

module.exports = {
  DataExporter
}; 