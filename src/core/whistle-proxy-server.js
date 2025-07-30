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
    
    // 在开发环境中使用相对路径，在生产环境中使用resources路径
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      this.certDir = path.join(__dirname, '..', '..', 'certs');
      this.whistleDir = path.join(__dirname, '..', '..', '.whistle');
    } else {
      // 在打包后的应用中，证书文件在resources目录中
      this.certDir = path.join(process.resourcesPath, 'certs');
      this.whistleDir = path.join(process.resourcesPath, '.whistle');
    }
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
    
    try {
      // 检查端口是否被占用
      await this.checkAndClearPort(this.port);
      
      // 检查并创建目录，添加详细的错误处理
      console.log('证书目录路径:', this.certDir);
      console.log('Whistle目录路径:', this.whistleDir);
      console.log('Whistle数据目录路径:', this.whistleDataDir);
      
      // 检查路径是否存在且为目录
      const certDirExists = await fs.pathExists(this.certDir);
      const whistleDirExists = await fs.pathExists(this.whistleDir);
      const whistleDataDirExists = await fs.pathExists(this.whistleDataDir);
      
      console.log('目录存在状态:', {
        certDir: certDirExists,
        whistleDir: whistleDirExists,
        whistleDataDir: whistleDataDirExists
      });
      
      // 如果路径存在但不是目录，删除它
      if (certDirExists) {
        const certDirStat = await fs.stat(this.certDir);
        if (!certDirStat.isDirectory()) {
          console.log('证书路径不是目录，删除:', this.certDir);
          await fs.remove(this.certDir);
        }
      }
      
      if (whistleDirExists) {
        const whistleDirStat = await fs.stat(this.whistleDir);
        if (!whistleDirStat.isDirectory()) {
          console.log('Whistle路径不是目录，删除:', this.whistleDir);
          await fs.remove(this.whistleDir);
        }
      }
      
      if (whistleDataDirExists) {
        const whistleDataDirStat = await fs.stat(this.whistleDataDir);
        if (!whistleDataDirStat.isDirectory()) {
          console.log('Whistle数据路径不是目录，删除:', this.whistleDataDir);
          await fs.remove(this.whistleDataDir);
        }
      }
      
      // 创建目录
      console.log('创建证书目录...');
      await fs.ensureDir(this.certDir);
      console.log('创建Whistle目录...');
      await fs.ensureDir(this.whistleDir);
      console.log('创建Whistle数据目录...');
      await fs.ensureDir(this.whistleDataDir);
      console.log('目录确认存在');
      
      // 启动Whistle进程，使用JavaScript配置文件
      const whistleConfigPath = path.join(this.whistleDir, 'whistle.js');
      console.log('Whistle配置文件路径:', whistleConfigPath);
      
      // 在打包后的环境中，使用不同的方式启动Whistle
      let command, args;
      
      if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        // 开发环境：使用npx
        command = 'npx';
        args = [
          'whistle', 
          'start', 
          '--port', this.port.toString(), 
          '--host', '127.0.0.1',
          '--config', whistleConfigPath,
          '--storage', this.whistleDataDir,
          '--shadowRules', '/.*/ enable://capture'
        ];
        
        console.log('开发环境：使用npx启动Whistle');
        this.process = spawn(command, args, {
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
      } else {
        // 生产环境：直接在主进程中启动Whistle
        console.log('生产环境：直接启动Whistle');
        
        try {
          // 首先检查whistle模块是否可用
          let whistle;
          try {
            whistle = require('whistle');
            console.log('Whistle模块加载成功');
          } catch (moduleError) {
            console.log('Whistle模块加载失败:', moduleError.message);
            throw new Error('Whistle模块不可用，请确保whistle包已正确打包');
          }
          
          // 确保配置文件存在
          const whistleConfigPath = path.join(this.whistleDir, 'whistle.js');
          if (!await fs.pathExists(whistleConfigPath)) {
            // 创建默认的Whistle配置文件
            const defaultConfig = `
module.exports = {
  port: ${this.port},
  host: '127.0.0.1',
  storage: '${this.whistleDataDir}',
  enableCaptureHttps: true,
  verbose: true,
  enableCaptureBody: true
};
`;
            await fs.writeFile(whistleConfigPath, defaultConfig);
            console.log('创建默认Whistle配置文件');
          }
          
          const config = {
            port: this.port,
            host: '127.0.0.1',
            config: whistleConfigPath,
            storage: this.whistleDataDir,
            shadowRules: '/.*/ enable://capture'
          };
          
          console.log('Whistle配置:', config);
          
          // 启动Whistle服务器 - 使用Promise包装异步启动
          await new Promise((resolve, reject) => {
            try {
              console.log('开始调用Whistle启动函数...');
              
              // 添加超时处理
              const timeout = setTimeout(() => {
                console.error('Whistle启动超时');
                reject(new Error('Whistle启动超时，请检查端口是否被占用'));
              }, 30000); // 30秒超时
              
              whistle(config, (err) => {
                clearTimeout(timeout);
                console.log('Whistle回调被调用，错误信息:', err);
                
                if (err) {
                  console.error('Whistle启动失败，错误详情:', err);
                  console.error('错误类型:', typeof err);
                  console.error('错误消息:', err.message);
                  console.error('错误堆栈:', err.stack);
                  
                  // 确保错误消息不为undefined
                  const errorMessage = err.message || err.toString() || '未知错误';
                  reject(new Error(`Whistle启动失败: ${errorMessage}`));
                } else {
                  console.log('Whistle服务器启动成功');
                  resolve();
                }
              });
            } catch (startError) {
              console.error('Whistle启动过程中出错:', startError);
              console.error('启动错误类型:', typeof startError);
              console.error('启动错误消息:', startError.message);
              console.error('启动错误堆栈:', startError.stack);
              reject(startError);
            }
          });
          
          // 创建一个虚拟进程对象来模拟子进程
          this.process = {
            stdout: { on: () => {} },
            stderr: { on: () => {} },
            on: (event, callback) => {
              if (event === 'close') {
                // 在应用退出时调用
                process.on('exit', () => {
                  console.log('应用退出，停止Whistle服务器');
                  callback(0);
                });
              }
            },
            kill: (signal) => {
              console.log('停止Whistle服务器');
              // Whistle会自动处理退出
            }
          };
          
          console.log('Whistle服务器已直接启动');
          
        } catch (error) {
          console.error('直接启动Whistle失败:', error);
          
          // 在打包后的环境中，如果直接启动失败，说明模块有问题
          // 不尝试使用外部命令，因为打包后的环境没有node/npx
          throw new Error(`无法启动 Whistle 服务器: ${error.message}`);
        }
      }
      
      // 监听输出
      if (this.process && this.process.stdout) {
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
      } else {
        // 生产环境：虚拟进程对象，直接标记为就绪
        console.log('生产环境：使用虚拟进程对象');
        this.onWhistleReady();
      }

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

  /**
   * 检查并清理端口
   * @param {number} port 端口号
   */
  async checkAndClearPort(port) {
    const net = require('net');
    
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      
      server.listen(port, '127.0.0.1', () => {
        // 端口可用
        server.close();
        console.log(`端口 ${port} 可用`);
        resolve();
      });
      
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`端口 ${port} 被占用，尝试清理...`);
          
          // 尝试清理端口
          this.killProcessOnPort(port).then(() => {
            console.log(`端口 ${port} 清理完成`);
            resolve();
          }).catch((killError) => {
            console.error(`清理端口 ${port} 失败:`, killError.message);
            reject(new Error(`端口 ${port} 被占用且无法清理，请手动关闭占用该端口的进程`));
          });
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * 杀死占用指定端口的进程
   * @param {number} port 端口号
   */
  async killProcessOnPort(port) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      if (process.platform === 'darwin') {
        // macOS: 使用 lsof 查找并杀死进程
        const { stdout } = await execAsync(`lsof -ti :${port}`);
        if (stdout.trim()) {
          const pids = stdout.trim().split('\n');
          for (const pid of pids) {
            if (pid && pid !== process.pid.toString()) {
              console.log(`杀死进程 ${pid}`);
              await execAsync(`kill -9 ${pid}`);
            }
          }
        }
      } else if (process.platform === 'win32') {
        // Windows: 使用 netstat 查找并杀死进程
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = stdout.split('\n');
        for (const line of lines) {
          const match = line.match(/\s+(\d+)$/);
          if (match) {
            const pid = match[1];
            if (pid && pid !== process.pid.toString()) {
              console.log(`杀死进程 ${pid}`);
              await execAsync(`taskkill /F /PID ${pid}`);
            }
          }
        }
      }
    } catch (error) {
      console.log('清理端口时出错:', error.message);
      // 不抛出错误，因为清理失败不是致命错误
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
    console.log('exportData 数据', data, format)
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