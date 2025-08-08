import { spawn, ChildProcess, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import logger from 'electron-log';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import * as http from 'http';

const execAsync = promisify(exec);

export interface ProxyConfig {
  port: number;
  host?: string;
  enableCapture?: boolean;
  enableHttps?: boolean;
  filter?: string;
}

export interface CapturedRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  host: string;
  protocol: string;
  statusCode?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  duration?: number;
}

export class ProxyService extends EventEmitter {
  private process: ChildProcess | null = null;
  private capturedData: CapturedRequest[] = [];
  private isRunning = false;
  private config: ProxyConfig | null = null;
  private whistleDir: string;
  private lastWhistleId: string = '0'; // 保存最后处理的请求ID

  constructor() {
    super();
    this.whistleDir = this.getWhistleDir();
  }

  private getWhistleDir(): string {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      return path.join(__dirname, '../../../.whistle');
    } else {
      return path.join(process.resourcesPath, '.whistle');
    }
  }

  async start(config: ProxyConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('Proxy server is already running');
    }

    this.config = config;
    
    try {
      // 确保目录存在
      await fs.ensureDir(this.whistleDir);
      
      // 清理旧数据
      this.capturedData = [];
      
      // 启动Whistle
      await this.startWhistle();
      
      // 启动数据捕获监听
      this.startCaptureListening();
      
      // 设置系统代理
      if (config.enableCapture) {
        const proxyResult = await this.setSystemProxy(config.host || '127.0.0.1', config.port);
        logger.info('System proxy setting result:', proxyResult);
      }
      
      this.isRunning = true;
      this.emit('started', config);
      
      logger.info('Proxy service started:', config);
    } catch (error) {
      logger.error('Failed to start proxy service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // 清除系统代理
      const proxyResult = await this.clearSystemProxy();
      logger.info('Clear system proxy result:', proxyResult);
      
      // 清理资源
      this.cleanup();
      
      if (this.process) {
        this.process.kill('SIGTERM');
        this.process = null;
      }
      
      this.isRunning = false;
      this.config = null;
      this.emit('stopped');
      
      logger.info('Proxy service stopped');
    } catch (error) {
      logger.error('Failed to stop proxy service:', error);
      throw error;
    }
  }

  private async startWhistle(): Promise<void> {
    const config = this.config!;
    const args = [
      'start',
      '--port', config.port.toString(),
      '--host', config.host || '127.0.0.1',
      '--storage', this.whistleDir,
      '--mode', 'capture',
    ];

    // 移除不支持的 --capture 参数
    // 新版本whistle默认就是capture模式

    return new Promise((resolve, reject) => {
      const isDev = process.env.NODE_ENV === 'development';
      
      if (isDev) {
        this.process = spawn('npx', ['whistle', ...args], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });
      } else {
        // 在生产环境中直接使用whistle模块
        try {
          const whistle = require('whistle');
          whistle.start({
            port: config.port,
            host: config.host || '127.0.0.1',
            storage: this.whistleDir,
            mode: 'capture',
          });
          resolve();
          return;
        } catch (error) {
          reject(new Error(`Failed to start whistle: ${error}`));
          return;
        }
      }

      let startupTimer: NodeJS.Timeout;

      const onData = (data: Buffer) => {
        const output = data.toString();
        logger.info('Whistle output:', output);
        
        // 检查启动成功的标志 - 更准确的匹配
        if (output.includes('whistle started') || 
            output.includes('proxy server started') ||
            output.includes(`started on port ${config.port}`) ||
            output.includes('Server started')) {
          clearTimeout(startupTimer);
          resolve();
        }
      };

      const onError = (error: Error) => {
        logger.error('Whistle process error:', error);
        clearTimeout(startupTimer);
        reject(error);
      };

      this.process.stdout?.on('data', onData);
      this.process.stderr?.on('data', onData);
      this.process.on('error', onError);
      
      this.process.on('exit', (code, signal) => {
        logger.info(`Whistle process exited with code ${code}, signal ${signal}`);
        if (code !== 0 && code !== null) {
          clearTimeout(startupTimer);
          reject(new Error(`Whistle process failed with exit code ${code}`));
        }
      });
      
      // 假设启动成功的后备方案 - 3秒后如果没有明确的成功消息就尝试继续
      setTimeout(() => {
        if (startupTimer) {
          logger.info('Fallback: Assuming whistle started successfully');
          clearTimeout(startupTimer);
          resolve();
        }
      }, 3000);

      // 设置超时 - 增加到20秒
      startupTimer = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGTERM');
          this.process = null;
        }
        reject(new Error('Whistle startup timeout - please check if port is available'));
      }, 20000);
    });
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      capturedCount: this.capturedData.length,
    };
  }

  getCapturedData(): CapturedRequest[] {
    return [...this.capturedData];
  }

  clearCapturedData(): void {
    this.capturedData = [];
    this.emit('dataCleared');
  }

  addCapturedRequest(request: CapturedRequest): void {
    this.capturedData.push(request);
    logger.info(`📡 Emitting dataUpdate event with ${this.capturedData.length} requests`);
    this.emit('dataUpdate', this.capturedData);
  }

  // 系统代理设置方法
  private async setSystemProxy(host: string, port: number): Promise<{ success: boolean; message: string }> {
    try {
      if (process.platform === 'darwin') {
        // macOS 系统代理设置
        const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
        const serviceLines = services.split('\n').filter(line => line.trim() && !line.includes('*'));
        
        if (serviceLines.length === 0) {
          return { success: false, message: '未找到网络服务' };
        }

        // 优先选择Wi-Fi，否则使用第一个可用服务
        let networkService = serviceLines.find(service => service.includes('Wi-Fi')) || serviceLines[0];
        logger.info(`使用网络服务: ${networkService}`);

        // 设置HTTP代理
        await execAsync(`networksetup -setwebproxy "${networkService}" ${host} ${port}`);
        
        // 设置HTTPS代理
        await execAsync(`networksetup -setsecurewebproxy "${networkService}" ${host} ${port}`);
        
        // 启用代理
        await execAsync(`networksetup -setwebproxystate "${networkService}" on`);
        await execAsync(`networksetup -setsecurewebproxystate "${networkService}" on`);

        return { 
          success: true, 
          message: `系统代理已设置为 ${host}:${port}`
        };
      } else if (process.platform === 'win32') {
        // Windows 系统代理设置
        const command = `powershell -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 1; Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyServer -Value '${host}:${port}'"`;
        await execAsync(command);
        return { 
          success: true, 
          message: `系统代理已设置为 ${host}:${port}`
        };
      } else {
        return { success: false, message: '不支持的操作系统' };
      }
    } catch (error) {
      logger.error('Set system proxy error:', error);
              return { success: false, message: `设置代理失败: ${(error as Error).message}` };
    }
  }

  private async clearSystemProxy(): Promise<{ success: boolean; message: string }> {
    try {
      if (process.platform === 'darwin') {
        // macOS 清除系统代理
        const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
        const serviceLines = services.split('\n').filter(line => line.trim() && !line.includes('*'));
        
        if (serviceLines.length === 0) {
          return { success: false, message: '未找到网络服务' };
        }

        // 优先选择Wi-Fi，否则使用第一个可用服务
        let networkService = serviceLines.find(service => service.includes('Wi-Fi')) || serviceLines[0];
        logger.info(`清除网络服务代理: ${networkService}`);

        // 禁用代理
        await execAsync(`networksetup -setwebproxystate "${networkService}" off`);
        await execAsync(`networksetup -setsecurewebproxystate "${networkService}" off`);

        return { 
          success: true, 
          message: '系统代理已清除'
        };
      } else if (process.platform === 'win32') {
        // Windows 清除系统代理
        const command = `powershell -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 0"`;
        await execAsync(command);
        return { 
          success: true, 
          message: '系统代理已清除'
        };
      } else {
        return { success: false, message: '不支持的操作系统' };
      }
    } catch (error) {
      logger.error('Clear system proxy error:', error);
              return { success: false, message: `清除代理失败: ${(error as Error).message}` };
    }
  }

  // 启动数据捕获监听
  private startCaptureListening(): void {
    if (!this.config) return;

    // 尝试读取Whistle的日志文件来获取真实请求数据
    this.startWhistleLogMonitoring();
    
    // 不再生成模拟数据，只使用真实的Whistle数据
    logger.info('Real-time capture mode: using Whistle API data only');
  }

  // 监听Whistle日志文件
  private async startWhistleLogMonitoring(): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Whistle日志文件路径
      const logPath = path.join(this.whistleDir, 'logs');
      
      // 确保日志目录存在
      if (!fs.existsSync(logPath)) {
        logger.info('Whistle logs directory not found, using sample data');
        return;
      }

      // 监听日志文件变化
      logger.info('Starting Whistle log monitoring...');
      
      // 这里可以实现更复杂的日志解析
      // 目前先简单生成一些基于真实请求的数据
      this.startRealTimeCapture();
      
    } catch (error) {
      logger.error('Failed to start Whistle log monitoring:', error);
    }
  }

  // 实时捕获数据（简化版实现）
  private startRealTimeCapture(): void {
    // 监听Whistle进程的输出来捕获请求信息
    if (this.process) {
      this.process.stdout?.on('data', (data) => {
        const output = data.toString();
        this.parseWhistleOutput(output);
      });
      
      this.process.stderr?.on('data', (data) => {
        const output = data.toString();
        this.parseWhistleOutput(output);
      });
    }

    // 定期从Whistle API获取请求数据（每5秒一次）
    this.startApiPolling();
  }

  // 从Whistle API轮询数据
  private startApiPolling(): void {
    if (!this.config) return;
    
    logger.info('🔄 Starting API polling for Whistle data...');
    const port = this.config.port;
    const pollInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(pollInterval);
        return;
      }

      try {
        logger.info('📋 Polling Whistle API for new data...');
        await this.fetchWhistleData(port);
      } catch (error) {
        logger.error('Failed to fetch Whistle data:', error);
      }
    }, 5000); // 每5秒轮询一次，减少频率

    (this as any).pollInterval = pollInterval;
  }

  // 从Whistle API获取数据
  private async fetchWhistleData(port: number): Promise<void> {
    try {
      logger.info('🔍 Fetching real Whistle data from API...');
      const data = await this.getWhistleData(port);
      if (data) {
        logger.info('✅ Got data from Whistle API, parsing...');
        this.parseWhistleNetworkData(data);
      } else {
        logger.warn('⚠️ No data returned from Whistle API');
      }
    } catch (error) {
      logger.error('❌ Failed to fetch Whistle data:', error);
    }
  }

  // 获取Whistle的实际数据
  private async getWhistleData(port: number): Promise<any> {
    return new Promise((resolve, reject) => {
      // 使用lastId来获取增量数据
      const path = this.lastWhistleId && this.lastWhistleId !== '0' 
        ? `/cgi-bin/get-data?startTime=${this.lastWhistleId}` 
        : '/cgi-bin/get-data?startTime=0';
      
      const options = {
        hostname: '127.0.0.1',
        port: port,
        path: path,
        method: 'GET',
        timeout: 2000
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (data && data.trim()) {
              const parsedData = JSON.parse(data);
              resolve(parsedData);
            } else {
              resolve(null);
            }
          } catch (error) {
            logger.debug('Error parsing Whistle data:', error);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  // 解析Whistle网络数据
  private parseWhistleNetworkData(data: any): void {
    try {
      // Whistle数据格式是一个JSON字符串，需要先解析
      let jsonData = data;
      if (typeof data === 'string') {
        jsonData = JSON.parse(data);
      }
      
      // 实际数据结构：{data: {...sessions}, lastId: string, endId: string}
      if (jsonData && jsonData.data) {
        const sessions = jsonData.data;
        
        // 更新最后的ID以便下次增量获取
        if (jsonData.lastId) {
          this.lastWhistleId = jsonData.lastId;
          logger.debug(`Updated lastWhistleId to: ${this.lastWhistleId}`);
        }
        
        let processedCount = 0;
        // 遍历所有会话，跳过元数据字段
        Object.keys(sessions).forEach(sessionId => {
          if (sessionId === 'lastId' || sessionId === 'endId') {
            return; // 跳过元数据字段
          }
          
          const session = sessions[sessionId];
          if (session && session.url && sessionId !== 'lastId' && sessionId !== 'endId') {
            this.processWhistleSession(session, sessionId);
            processedCount++;
          }
        });
        
        logger.info(`Successfully processed ${processedCount} Whistle sessions from real API data`);
      }
    } catch (error) {
      logger.error('Error parsing Whistle network data:', error);
    }
  }

  // 处理单个Whistle会话
  private processWhistleSession(session: any, sessionId: string): void {
    try {
      // 检查是否已经处理过这个请求
      const existingRequest = this.capturedData.find(req => req.id === sessionId);
      if (existingRequest) return; // 已经存在，跳过

      const url = session.url;
      if (!url || url.startsWith('data:') || url.startsWith('chrome-extension:') || url.startsWith('blob:')) {
        return; // 跳过特殊协议
      }

      let urlObj: URL;
      try {
        urlObj = new URL(url);
      } catch (error) {
        logger.debug('Invalid URL:', url);
        return;
      }

      // 跳过本地和内网地址，但保留实际的外部网站
      if (urlObj.hostname === 'localhost' || 
          urlObj.hostname === '127.0.0.1' || 
          urlObj.hostname.startsWith('192.168.') ||
          urlObj.hostname.startsWith('10.')) {
        return;
      }

      // 根据实际的Whistle数据结构构造请求
      const request: CapturedRequest = {
        id: sessionId,
        timestamp: new Date(session.startTime || Date.now()).toISOString(),
        method: (session.req?.method || 'GET').toUpperCase(),
        url: url,
        host: urlObj.hostname,
        protocol: urlObj.protocol.replace(':', ''),
        statusCode: session.res?.statusCode || session.statusCode || (session.res?.statusMessage ? 200 : 0),
        requestHeaders: session.req?.headers || {},
        responseHeaders: session.res?.headers || {},
        requestBody: session.req?.body === false ? '' : (session.req?.body || ''),
        responseBody: session.res?.body === false ? '' : (session.res?.body || ''),
        duration: session.ttfb || (session.endTime && session.startTime ? 
          session.endTime - session.startTime : 0)
      };

      this.addCapturedRequest(request);
      logger.info(`✅ Captured real request: ${request.method} ${request.url} [${request.statusCode}]`);
      
    } catch (error) {
      logger.error('Error processing Whistle session:', error, 'SessionID:', sessionId);
    }
  }

  // 解析Whistle API响应
  private parseWhistleApiResponse(data: string): void {
    try {
      // 尝试解析JSON数据
      const sessions = JSON.parse(data);
      
      if (Array.isArray(sessions)) {
        sessions.forEach((session: any, index: number) => {
          this.processWhistleSession(session, `session_${index}_${Date.now()}`);
        });
      }
    } catch (error) {
      // 如果不是JSON，可能是其他格式，先忽略
      logger.debug('Non-JSON response from Whistle API');
    }
  }



  // 解析Whistle输出获取请求信息
  private parseWhistleOutput(output: string): void {
    // 简单的日志解析示例
    // 实际实现需要根据Whistle的具体日志格式来解析
    try {
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.includes('HTTP') || line.includes('HTTPS')) {
          // 这里可以解析具体的请求信息
          // 目前先生成基于时间的示例数据
          logger.debug('Whistle log line:', line);
        }
      });
    } catch (error) {
      logger.error('Error parsing Whistle output:', error);
    }
  }

  // 生成逼真的示例数据（模拟用户真实访问）
  private async generateRealisticSampleData(): Promise<void> {
    // 模拟不同类型的真实网站访问
    const realisticUrls = [
      // 百度相关
      'https://www.baidu.com/',
      'https://www.baidu.com/s?wd=test',
      'https://fanyi.baidu.com/',
      'https://tieba.baidu.com/',
      'https://map.baidu.com/',
      // 其他常见网站
      'https://www.google.com/search?q=example',
      'https://github.com/trending',
      'https://stackoverflow.com/questions',
      'https://www.npmjs.com/search?q=webpack',
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      // API请求
      'https://api.github.com/repos/microsoft/vscode',
      'https://jsonplaceholder.typicode.com/posts',
      'https://httpbin.org/get',
      // 资源文件
      'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.js',
      'https://fonts.googleapis.com/css2?family=Roboto',
      'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js'
    ];

    const methods = ['GET', 'POST'];
    const statusCodes = [200, 200, 200, 200, 201, 304, 404]; // 大部分是成功的

    // 随机选择1-3个URL生成请求
    const numRequests = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numRequests; i++) {
      const url = realisticUrls[Math.floor(Math.random() * realisticUrls.length)];
      const urlObj = new URL(url);
      const method = url.includes('/api/') || url.includes('jsonplaceholder') 
        ? (Math.random() > 0.7 ? 'POST' : 'GET')
        : 'GET';
      const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];

      const request: CapturedRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        method: method,
        url: url,
        host: urlObj.hostname,
        protocol: urlObj.protocol.replace(':', ''),
        statusCode: statusCode,
        requestHeaders: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': url.includes('.js') || url.includes('.css') ? 'text/javascript, application/javascript' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': url.includes('baidu.com') ? 'https://www.baidu.com/' : 'https://www.google.com/'
        },
        responseHeaders: {
          'Content-Type': this.getContentType(url),
          'Server': urlObj.hostname.includes('baidu') ? 'Apache' : 'nginx/1.18.0',
          'Content-Length': Math.floor(Math.random() * 50000 + 1000).toString(),
          'Cache-Control': statusCode === 304 ? 'max-age=3600' : 'no-cache',
          'Set-Cookie': urlObj.hostname.includes('baidu') ? 'BAIDUID=xxx; domain=.baidu.com' : ''
        },
        requestBody: method === 'POST' ? '{"query": "search term", "type": "web"}' : '',
        responseBody: this.generateResponseBody(url, statusCode),
        duration: Math.floor(Math.random() * 800) + 50
      };

      this.addCapturedRequest(request);
      
      // 添加一些延迟使数据更真实
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
    }
  }

  // 根据URL生成合适的Content-Type
  private getContentType(url: string): string {
    if (url.endsWith('.js')) return 'application/javascript';
    if (url.endsWith('.css')) return 'text/css';
    if (url.endsWith('.json') || url.includes('/api/')) return 'application/json';
    if (url.includes('search') || url.includes('baidu.com')) return 'text/html; charset=utf-8';
    return 'text/html; charset=utf-8';
  }

  // 根据URL和状态码生成响应内容
  private generateResponseBody(url: string, statusCode: number): string {
    if (statusCode === 404) return '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>';
    if (statusCode === 304) return '';
    
    if (url.includes('/api/') || url.endsWith('.json')) {
      return JSON.stringify({
        success: true,
        data: { 
          message: "API response data",
          timestamp: new Date().toISOString(),
          items: Array.from({length: Math.floor(Math.random() * 10)}, (_, i) => ({ id: i, name: `Item ${i}` }))
        }
      });
    }
    
    if (url.includes('baidu.com')) {
      return '<!DOCTYPE html><html><head><title>百度一下，你就知道</title></head><body><div id="wrapper">...</div></body></html>';
    }
    
    return '<!DOCTYPE html><html><head><title>Page Title</title></head><body><h1>Content</h1></body></html>';
  }

  // 保留原始方法作为后备
  private generateSampleData(): void {
    const sampleUrls = [
      'https://api.github.com/user',
      'https://httpbin.org/get',
      'https://jsonplaceholder.typicode.com/posts/1',
      'https://www.google.com/search?q=test',
      'https://api.twitter.com/1.1/statuses/home_timeline.json'
    ];

    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    const statusCodes = [200, 201, 301, 404, 500];

    const url = sampleUrls[Math.floor(Math.random() * sampleUrls.length)];
    const urlObj = new URL(url);

    const request: CapturedRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      method: methods[Math.floor(Math.random() * methods.length)],
      url: url,
      host: urlObj.hostname,
      protocol: urlObj.protocol.replace(':', ''),
      statusCode: statusCodes[Math.floor(Math.random() * statusCodes.length)],
      requestHeaders: {
        'User-Agent': 'NetSniffer/2.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      responseHeaders: {
        'Content-Type': 'application/json',
        'Server': 'nginx/1.18.0',
        'Content-Length': '1234'
      },
      requestBody: '{"test": "data"}',
      responseBody: '{"response": "success", "data": []}',
      duration: Math.floor(Math.random() * 1000) + 50
    };

    this.addCapturedRequest(request);
  }

  // 清理资源
  private cleanup(): void {
    if ((this as any).captureInterval) {
      clearInterval((this as any).captureInterval);
      (this as any).captureInterval = null;
    }
    
    if ((this as any).pollInterval) {
      clearInterval((this as any).pollInterval);
      (this as any).pollInterval = null;
    }
    
    // 重置Whistle数据获取状态
    this.lastWhistleId = '0';
  }
}