const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const http = require('http');

class WhistleProxyServer {
  constructor() {
    console.log('WhistleProxyServer 构造函数被调用');
    this.process = null;
    this.capturedData = [];
    this.port = 7788;
    this.isRunning = false;
    this.certDir = path.join(__dirname, '..', '..', 'certs');
    this.whistleDir = path.join(__dirname, '..', '..', '.whistle');
    this.whistleDataDir = path.join(this.whistleDir, 'whistle-data');
    
    console.log('WhistleProxyServer 初始化完成');
  }

  async start(config = {}) {
    console.log('WhistleProxyServer.start() 被调用');
    console.log('配置:', config);
    
    if (this.isRunning) {
      throw new Error('代理服务器已在运行');
    }

    this.port = config.port || 7788;
    console.log('使用端口:', this.port);
    
    // 确保证书目录存在
    await fs.ensureDir(this.certDir);
    await fs.ensureDir(this.whistleDir);
    await fs.ensureDir(this.whistleDataDir);
    console.log('目录确认存在');
    
    try {
      // 启动Whistle进程，使用JavaScript配置文件
      const whistleConfigPath = path.join(this.whistleDir, 'whistle.js');
      console.log('Whistle配置文件路径:', whistleConfigPath);
      
      // 使用更详细的启动参数，确保配置文件被正确加载
      this.process = spawn('npx', [
        'whistle', 
        'start', 
        '--port', this.port.toString(), 
        '--host', '127.0.0.1',
        '--config', whistleConfigPath,
        '--storage', this.whistleDataDir,
        '--shadowRules', '/.*/ enable://capture'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          WHISTLE_PORT: this.port.toString(),
          WHISTLE_HOST: '127.0.0.1',
          WHISTLE_CONFIG: whistleConfigPath,
          WHISTLE_STORAGE: this.whistleDataDir
        }
      });

      // 监听输出
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Whistle stdout:', output);
        
        // 检查是否启动成功
        if (output.includes('set the HTTP proxy') || 
            output.includes('visit http://local.whistlejs.com') ||
            output.includes('whistle started')) {
          console.log('检测到Whistle启动成功');
          this.onWhistleReady();
        }
      });

      this.process.stderr.on('data', (data) => {
        console.log('Whistle stderr:', data.toString());
      });

      // 监听进程退出
      this.process.on('close', (code) => {
        console.log(`Whistle进程退出，代码: ${code}`);
        this.isRunning = false;
      });

      // 等待Whistle启动
      await this.waitForWhistleReady();
      
      this.isRunning = true;
      console.log(`Whistle代理服务器启动在端口 ${this.port}`);
      
      // 启动数据收集服务
      this.startDataCollector();
      
    } catch (error) {
      console.error('启动Whistle服务器失败:', error);
      throw error;
    }
  }

  async waitForWhistleReady() {
    const maxAttempts = 30; // 最多等待30秒
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        // 尝试访问Whistle的管理页面
        const response = await this.makeRequest('GET', '/cgi-bin/get-data');
        if (response) {
          console.log('Whistle服务器已就绪');
          return;
        }
      } catch (error) {
        console.log(`等待Whistle启动... (${attempts + 1}/${maxAttempts})`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error('Whistle服务器启动超时');
  }

  onWhistleReady() {
    console.log('Whistle服务器准备就绪');
  }

  startDataCollector() {
    // 定期从Whistle获取数据
    this.dataInterval = setInterval(async () => {
      try {
        await this.fetchDataFromWhistle();
      } catch (error) {
        console.log('获取Whistle数据失败:', error.message);
        // 不添加模拟数据，避免干扰真实数据
      }
    }, 2000); // 每2秒获取一次数据
  }

  async fetchDataFromWhistle() {
    try {
      // 使用正确的Whistle API
      const response = await this.makeRequest('GET', '/cgi-bin/get-data');
      
      // Whistle返回的数据结构是 { data: { data: {...} } }
      if (response && response.data && response.data.data) {
        // 将对象转换为数组
        const dataArray = Object.values(response.data.data);
        this.processWhistleData(dataArray);
      }
    } catch (error) {
      console.error('从Whistle获取数据失败:', error);
      throw error;
    }
  }

  async makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: this.port,
        path: path,
        method: method,
        timeout: 5000
      };

      // 如果是POST请求且有数据，添加Content-Type头
      if (method === 'POST' && data) {
        options.headers = {
          'Content-Type': 'application/json'
        };
      }

      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              // 对于规则设置API，可能返回非JSON数据
              try {
                const jsonData = JSON.parse(responseData);
                resolve(jsonData);
              } catch (parseError) {
                // 如果不是JSON，直接返回响应文本
                resolve(responseData);
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          } catch (e) {
            reject(new Error('解析响应数据失败'));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      if (data) {
        req.write(typeof data === 'string' ? data : JSON.stringify(data));
      }
      req.end();
    });
  }

  processWhistleData(data) {
    // 处理Whistle返回的数据格式
    if (Array.isArray(data)) {
      data.forEach(item => {
        // 跳过有错误的请求
        if (item.captureError || item.reqError) {
          return;
        }
        
        console.log('item数据格式', item);
        
        // 转换Whistle数据格式为我们的格式
        const requestData = {
          timestamp: item.startTime || new Date().toISOString(),
          method: item.req?.method || 'GET',
          url: item.url || '',
          host: this.extractHost(item.url) || '',
          protocol: this.extractProtocol(item.url) || 'http',
          statusCode: item.res?.statusCode || null,
          headers: this.parseHeaders(item.req?.headers) || {},
          responseHeaders: this.parseHeaders(item.res?.headers) || {},
          requestBody: this.extractBody(item.req) || '',
          responseBody: this.extractBody(item.res) || '',
          requestBodySize: this.getBodySize(item.req) || 0,
          responseBodySize: this.getBodySize(item.res) || 0,
          duration: item.duration || 0,
          size: item.size || 0
        };

        // 避免重复添加
        const exists = this.capturedData.find(existing => 
          existing.url === requestData.url && 
          existing.timestamp === requestData.timestamp &&
          existing.method === requestData.method
        );

        if (!exists) {
          this.capturedData.push(requestData);
          console.log(`捕获请求: ${requestData.method} ${requestData.url}`);
          console.log(`请求体大小: ${requestData.requestBodySize}, 响应体大小: ${requestData.responseBodySize}`);
        }
      });
    }
  }

  // 提取请求体或响应体
  extractBody(reqOrRes) {
    if (!reqOrRes) return '';
    
    // 首先尝试获取base64编码的数据
    if (reqOrRes.base64) {
      try {
        const decoded = Buffer.from(reqOrRes.base64, 'base64').toString('utf8');
        return decoded;
      } catch (error) {
        console.log('Base64解码失败:', error.message);
      }
    }
    
    // 尝试多种可能的字段
    const body = reqOrRes.body || reqOrRes.data || reqOrRes.content || '';
    
    // 如果是Buffer，转换为字符串
    if (Buffer.isBuffer(body)) {
      return body.toString('utf8');
    }
    
    // 如果是对象，转换为JSON字符串
    if (typeof body === 'object' && body !== null) {
      try {
        return JSON.stringify(body, null, 2);
      } catch (error) {
        return String(body);
      }
    }
    
    return String(body);
  }

  // 获取请求体或响应体大小
  getBodySize(reqOrRes) {
    if (!reqOrRes) return 0;
    
    // 首先尝试获取base64编码的数据大小
    if (reqOrRes.base64) {
      try {
        const decoded = Buffer.from(reqOrRes.base64, 'base64');
        return decoded.length;
      } catch (error) {
        console.log('Base64解码失败:', error.message);
      }
    }
    
    const body = reqOrRes.body || reqOrRes.data || reqOrRes.content || '';
    
    if (Buffer.isBuffer(body)) {
      return body.length;
    }
    
    if (typeof body === 'string') {
      return body.length;
    }
    
    if (typeof body === 'object' && body !== null) {
      try {
        return JSON.stringify(body).length;
      } catch (error) {
        return String(body).length;
      }
    }
    
    return 0;
  }

  extractHost(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return '';
    }
  }

  extractProtocol(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol.replace(':', '');
    } catch (error) {
      return 'http';
    }
  }

  parseHeaders(headers) {
    if (!headers) return {};
    
    if (typeof headers === 'string') {
      try {
        return JSON.parse(headers);
      } catch (error) {
        return {};
      }
    }
    
    return headers;
  }

  async stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    
    if (this.dataInterval) {
      clearInterval(this.dataInterval);
      this.dataInterval = null;
    }
    
    this.isRunning = false;
    console.log('Whistle代理服务器已停止');
  }

  getCapturedData() {
    return this.capturedData.map(item => {
      try {
        return {
          timestamp: item.timestamp || new Date().toISOString(),
          method: String(item.method || ''),
          url: String(item.url || ''),
          host: String(item.host || ''),
          protocol: String(item.protocol || ''),
          statusCode: item.statusCode || null,
          headers: item.headers || {},
          responseHeaders: item.responseHeaders || {},
          requestBody: item.requestBody || '',
          responseBody: item.responseBody || '',
          requestBodySize: item.requestBodySize || 0,
          responseBodySize: item.responseBodySize || 0,
          duration: item.duration || 0,
          size: item.size || 0
        };
      } catch (error) {
        console.error('数据清理失败:', error);
        return {
          timestamp: new Date().toISOString(),
          method: 'UNKNOWN',
          url: '',
          host: '',
          protocol: 'unknown',
          statusCode: null,
          headers: {},
          responseHeaders: {},
          requestBody: '',
          responseBody: '',
          requestBodySize: 0,
          responseBodySize: 0,
          duration: 0,
          size: 0
        };
      }
    });
  }

  async exportData(filePath, format = 'json') {
    const data = this.getCapturedData();
    
    if (format === 'json') {
      await fs.writeJson(filePath, data, { spaces: 2 });
    } else if (format === 'csv') {
      const csvData = this.convertToCSV(data);
      await fs.writeFile(filePath, csvData, 'utf8');
    } else {
      throw new Error('不支持的导出格式');
    }
  }

  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = ['时间戳', '方法', 'URL', '主机', '协议', '状态码', '请求体大小', '响应体大小', '耗时(ms)', '总大小'];
    const rows = data.map(item => [
      item.timestamp,
      item.method,
      item.url,
      item.host,
      item.protocol,
      item.statusCode || '',
      item.requestBodySize || 0,
      item.responseBodySize || 0,
      item.duration || 0,
      item.size || 0
    ]);

    return [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  clearData() {
    this.capturedData = [];
  }

  // 获取证书信息
  async getCertificateInfo() {
    try {
      const certPath = path.join(this.certDir, 'rootCA.crt');
      const keyPath = path.join(this.certDir, 'rootCA.key');
      
      const exists = await fs.pathExists(certPath) && await fs.pathExists(keyPath);
      
      return {
        exists,
        certPath: exists ? certPath : null,
        keyPath: exists ? keyPath : null
      };
    } catch (error) {
      console.error('获取证书信息失败:', error);
      return { exists: false, certPath: null, keyPath: null };
    }
  }

  // 获取Whistle状态
  async getWhistleStatus() {
    try {
      const response = await this.makeRequest('GET', '/cgi-bin/status');
      return response;
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = { WhistleProxyServer }; 