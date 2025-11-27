import { spawn, ChildProcess, exec, fork as forkNode } from 'child_process';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import logger from 'electron-log';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import * as http from 'http';
import * as zlib from 'zlib';

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
  private clearedAtMs: number | null = null; // 记录最近一次清空的时间，用于忽略旧数据

  // 将各种可能的时间格式转换为毫秒时间戳；失败则返回 0
  private toEpochMs(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  }

  constructor() {
    super();
    this.whistleDir = this.getWhistleDir();
  }

  private getWhistleDir(): string {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      return path.join(__dirname, '../../../.whistle');
    }
    // 生产环境：使用用户可写目录
    try {
      // 延迟引入 electron，避免打包时外部依赖解析问题
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { app } = require('electron');
      return path.join(app.getPath('userData'), '.whistle');
    } catch {
      // 兜底：仍然使用 resources 边上的 .whistle_fallback（不推荐）
      return path.join(process.resourcesPath, '.whistle_fallback');
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

      // 启动前先确保端口未被占用（关闭占用该端口的进程或已有实例）
      await this.freePort(config.port);

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

      // 停止 whistle 服务（无论子进程是否存在，都执行一次 stop 命令以确保守护进程被关闭）
      await this.stopWhistle();

      // 清理资源
      this.cleanup();

      if (this.process) {
        try {
          // 通过内置命令停止后，再次确保子进程被杀死
          this.process.kill('SIGTERM');
        } catch (e) {}
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

  // 显式停止 whistle 服务
  private async stopWhistle(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const whistleBin = require.resolve('whistle/bin/whistle');
        // 与启动时保持同一 storage，否则可能停止的是默认实例，导致端口仍在监听
        const args = [whistleBin, 'stop'];
        if (this.whistleDir) {
          args.push('--storage', this.whistleDir);
        }
        const stopProc = spawn(process.execPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });

        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };

        stopProc.on('exit', () => finish());
        stopProc.on('error', () => finish());
        // 超时兜底
        setTimeout(() => finish(), 2000);
      } catch (e) {
        // 若解析失败（如依赖缺失），也直接继续，避免阻塞
        resolve();
      }
    });
  }

  // 关闭占用指定端口的进程（仅本机 127.0.0.1 场景，谨慎使用）
  private async freePort(port: number): Promise<void> {
    try {
      if (process.platform === 'darwin' || process.platform === 'linux') {
        const { stdout } = await execAsync(`lsof -ti tcp:${port}`);
        const pids = (stdout || '').split(/\s+/).filter(Boolean);
        for (const pid of pids) {
          try {
            process.kill(Number(pid));
          } catch {}
        }
      } else if (process.platform === 'win32') {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = (stdout || '').split(/\r?\n/).filter(Boolean);
        const pids = Array.from(
          new Set(lines.map((l) => (l.trim().split(/\s+/).pop() || '').trim()).filter(Boolean))
        );
        for (const pid of pids) {
          try {
            await execAsync(`taskkill /PID ${pid} /F`);
          } catch {}
        }
      }
    } catch {}
  }

  private async startWhistle(): Promise<void> {
    const config = this.config!;
    // 使用 Electron utilityProcess.fork 启动纯 Node 子进程，编程式 require('whistle')
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // 计算 whistle 绝对入口，避免子进程解析失败
          let whistleEntry: string | undefined;
          try {
            const resourcesDir: string | undefined =
              (process as any).resourcesPath ||
              (app && (app as any).getAppPath && path.dirname((app as any).getAppPath()));
            const bases: string[] = [];
            if (resourcesDir) {
              bases.push(path.join(resourcesDir, 'app.asar.unpacked', 'node_modules'));
              bases.push(path.join(resourcesDir, 'node_modules'));
            }
            // 开发模式或兜底：尝试直接 require.resolve
            try {
              const devResolved = require.resolve('whistle');
              if (devResolved) whistleEntry = devResolved;
            } catch {}
            for (const base of bases) {
              const abs = path.join(base, 'whistle', 'index.js');
              try {
                if (fs.existsSync(abs)) {
                  whistleEntry = abs;
                  break;
                }
              } catch {}
            }
          } catch {}
          logger.info('Whistle preferred entry:', whistleEntry || '(not found)');

          const childArgs = [
            encodeURIComponent(
              JSON.stringify({
                port: config.port,
                host: config.host || '127.0.0.1',
                storage: this.whistleDir,
                mode: 'capture',
                whistleEntry: whistleEntry || '',
                userDataDir: app.getPath('userData') || '',
              })
            ),
          ];

          // 允许较大的 HTTP 头（与 whistle-client 一致）
          const execArgv = ['--max-semi-space-size=64', '--tls-min-v1.0'];
          execArgv.push('--max-http-header-size=65536');

          // 优先使用解包路径下的子进程脚本，避免 asar 内模块解析差异
          let scriptPath = path.join(__dirname, 'whistle-child.js');
          try {
            const unpackedScript = path.join(
              (process as any).resourcesPath || '',
              'app.asar.unpacked',
              'dist',
              'whistle-child.js'
            );
            if (fs.existsSync(unpackedScript)) {
              scriptPath = unpackedScript;
            }
          } catch {}
          // 构造 NODE_PATH 指向解包/asar 的 node_modules，确保子进程可解析 whistle
          const resourcesPath: string = (process as any).resourcesPath || '';
          const unpackedNodeModules = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
          const asarNodeModules = path.join(resourcesPath, 'app.asar', 'node_modules');
          const nodePathParts = [process.env.NODE_PATH || ''];
          if (fs.existsSync(unpackedNodeModules)) nodePathParts.push(unpackedNodeModules);
          if (fs.existsSync(asarNodeModules)) nodePathParts.push(asarNodeModules);
          const env = {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_PATH: nodePathParts.filter(Boolean).join(path.delimiter),
          } as NodeJS.ProcessEnv;

          const child = forkNode(scriptPath, childArgs, {
            execArgv,
            env,
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          });
          this.process = child as unknown as ChildProcess;

          child.once('exit', (code: number) => {
            if (code && code !== 0) {
              reject(new Error(`Whistle child exited with code ${code}`));
            }
          });
          // utilityProcess 没有 'error' 事件，这里监听 'spawn' 并依赖 'exit' 上报错误
          child.on('spawn', () => {
            // no-op
          });
          child.on('message', async (msg: any) => {
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'debug') {
              logger.info('Whistle child debug:', msg);
              return;
            }
            if (msg.type === 'error') {
              return reject(new Error(msg.message || 'whistle child error'));
            }
            if (msg.type === 'ready') {
              try {
                (this.process as any)?.send?.({ type: 'enableCapture' });
              } catch {}
              // 子进程就绪后再探活一次
              const ok = await this.pingWhistle(config.port);
              if (!ok) return reject(new Error('Whistle not responding'));
              return resolve();
            }
          });
        } catch (error) {
          logger.error('Failed to start whistle (utilityProcess):', error);
          reject(error as Error);
        }
      })();
    });
  }

  private async pingWhistle(port: number): Promise<boolean> {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { hostname: '127.0.0.1', port, path: '/', method: 'GET', timeout: 800 },
          (res) => {
            res.resume();
            resolve();
          }
        );
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy(new Error('timeout'));
        });
        req.end();
      });
      return true;
    } catch {
      return false;
    }
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

  // 供渲染进程按需轮询：立即从 Whistle 拉取一次并返回标准化后的列表
  public async fetchWhistleSnapshot(): Promise<CapturedRequest[]> {
    try {
      if (this.config && this.isRunning) {
        await this.fetchWhistleData(this.config.port);
      }
    } catch (e) {
      logger.warn('fetchWhistleSnapshot failed:', e);
    }
    return this.getCapturedData();
  }

  // 提供原始 Whistle 数据的按需获取（页面自行处理结构）
  public async getWhistleRaw(options?: { startId?: string; ids?: string[] }): Promise<any> {
    const port = this.config?.port;
    if (!port || !this.isRunning) return null;
    const ids = options?.ids;
    if (ids && ids.length > 0) {
      return this.getWhistleDataByIds(port, ids);
    }
    const startId = typeof options?.startId === 'string' ? options?.startId : this.lastWhistleId;
    const path =
      startId && startId !== '0'
        ? `/cgi-bin/get-data?startId=${encodeURIComponent(startId)}`
        : '/cgi-bin/get-data?startId=0';
    return this.getWhistleJson(port, path);
  }

  // 重置增量游标（不清空已捕获数据，由页面按需调用 clearCapturedData）
  public resetWhistleCursor(): void {
    this.lastWhistleId = '0';
  }

  clearCapturedData(): void {
    this.capturedData = [];
    this.clearedAtMs = Date.now();
    this.emit('dataCleared');
  }

  addCapturedRequest(request: CapturedRequest): void {
    this.capturedData.push(request);
    logger.info(`📡 Emitting dataUpdate event with ${this.capturedData.length} requests`);
    logger.info(`📝 New request: ${request.method} ${request.url}`);
    this.emit('dataUpdate', this.capturedData);
  }

  // 合并新的更完整信息到已存在的记录
  private mergeCapturedRequestFields(existing: CapturedRequest, incoming: CapturedRequest): void {
    if (!existing || !incoming) return;
    // 覆盖更有价值的数据（非空/非0）
    if ((incoming.statusCode || 0) > 0 && (!existing.statusCode || existing.statusCode === 0)) {
      existing.statusCode = incoming.statusCode;
    }
    if (
      incoming.requestHeaders &&
      Object.keys(incoming.requestHeaders).length > 0 &&
      (!existing.requestHeaders || Object.keys(existing.requestHeaders).length === 0)
    ) {
      existing.requestHeaders = incoming.requestHeaders;
    }
    if (
      incoming.responseHeaders &&
      Object.keys(incoming.responseHeaders).length > 0 &&
      (!existing.responseHeaders || Object.keys(existing.responseHeaders).length === 0)
    ) {
      existing.responseHeaders = incoming.responseHeaders;
    }
    if (incoming.requestBody && !existing.requestBody) {
      existing.requestBody = incoming.requestBody;
    }
    if (incoming.responseBody && !existing.responseBody) {
      existing.responseBody = incoming.responseBody;
    }
    if ((incoming.duration || 0) > 0 && (!existing.duration || existing.duration === 0)) {
      existing.duration = incoming.duration;
    }
  }

  // 系统代理设置方法
  public async setSystemProxy(
    host: string,
    port: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (process.platform === 'darwin') {
        // macOS：对所有启用的网络服务设置代理
        const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
        const serviceLines = services
          .split('\n')
          .map((s) => s.trim())
          .filter(
            (line) =>
              line &&
              !line.startsWith('*') &&
              !/^An asterisk \(\*\) denotes that a network service is disabled\.?$/i.test(line)
          );

        if (serviceLines.length === 0) {
          return { success: false, message: '未找到网络服务' };
        }

        let successCount = 0;
        for (const networkService of serviceLines) {
          try {
            // 跳过已禁用的网络服务
            const { stdout: enabledOut } = await execAsync(
              `networksetup -getnetworkserviceenabled "${networkService}"`
            );
            if (!/^Enabled$/i.test(enabledOut.trim())) {
              logger.info(`跳过已禁用网络服务: ${networkService}`);
              continue;
            }

            logger.info(`设置系统代理: ${networkService} -> ${host}:${port}`);
            await execAsync(`networksetup -setwebproxy "${networkService}" ${host} ${port}`);
            await execAsync(`networksetup -setsecurewebproxy "${networkService}" ${host} ${port}`);
            await execAsync(`networksetup -setwebproxystate "${networkService}" on`);
            await execAsync(`networksetup -setsecurewebproxystate "${networkService}" on`);
            successCount++;
          } catch (e) {
            logger.warn(`设置系统代理失败(${networkService}):`, e);
          }
        }

        return successCount > 0
          ? { success: true, message: `系统代理已设置为 ${host}:${port}` }
          : { success: false, message: '所有网络服务设置代理均失败' };
      } else if (process.platform === 'win32') {
        // Windows 系统代理设置
        const command = `powershell -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 1; Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyServer -Value '${host}:${port}'"`;
        await execAsync(command);
        return {
          success: true,
          message: `系统代理已设置为 ${host}:${port}`,
        };
      } else {
        return { success: false, message: '不支持的操作系统' };
      }
    } catch (error) {
      logger.error('Set system proxy error:', error);
      return { success: false, message: `设置代理失败: ${(error as Error).message}` };
    }
  }

  public async clearSystemProxy(): Promise<{ success: boolean; message: string }> {
    try {
      if (process.platform === 'darwin') {
        // macOS：对所有启用的网络服务关闭代理
        const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
        const serviceLines = services
          .split('\n')
          .map((s) => s.trim())
          .filter(
            (line) =>
              line &&
              !line.startsWith('*') &&
              !/^An asterisk \(\*\) denotes that a network service is disabled\.?$/i.test(line)
          );

        if (serviceLines.length === 0) {
          return { success: false, message: '未找到网络服务' };
        }

        let successCount = 0;
        for (const networkService of serviceLines) {
          try {
            const { stdout: enabledOut } = await execAsync(
              `networksetup -getnetworkserviceenabled "${networkService}"`
            );
            if (!/^Enabled$/i.test(enabledOut.trim())) {
              logger.info(`跳过已禁用网络服务: ${networkService}`);
              continue;
            }

            logger.info(`清除网络服务代理: ${networkService}`);
            await execAsync(`networksetup -setwebproxystate "${networkService}" off`);
            await execAsync(`networksetup -setsecurewebproxystate "${networkService}" off`);
            successCount++;
          } catch (e) {
            logger.warn(`清除系统代理失败(${networkService}):`, e);
          }
        }

        return successCount > 0
          ? { success: true, message: '系统代理已清除' }
          : { success: false, message: '所有网络服务清除代理均失败' };
      } else if (process.platform === 'win32') {
        // Windows 清除系统代理
        const command = `powershell -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 0"`;
        await execAsync(command);
        return {
          success: true,
          message: '系统代理已清除',
        };
      } else {
        return { success: false, message: '不支持的操作系统' };
      }
    } catch (error) {
      logger.error('Clear system proxy error:', error);
      return { success: false, message: `清除代理失败: ${(error as Error).message}` };
    }
  }

  // 查询系统代理状态（是否启用 HTTP/HTTPS 代理）
  public async getSystemProxyStatus(): Promise<
    { success: true; enabled: boolean; details?: any } | { success: false; message: string }
  > {
    try {
      if (process.platform === 'darwin') {
        const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
        const serviceLines = services
          .split('\n')
          .map((s) => s.trim())
          .filter(
            (line) =>
              line &&
              !line.startsWith('*') &&
              !/^An asterisk \(\*\) denotes that a network service is disabled\.?$/i.test(line)
          );
        const enabledStatuses: Array<{ service: string; http: boolean; https: boolean }> = [];
        for (const networkService of serviceLines) {
          try {
            const { stdout: enabledOut } = await execAsync(
              `networksetup -getnetworkserviceenabled "${networkService}"`
            );
            if (!/^Enabled$/i.test(enabledOut.trim())) continue;

            const { stdout: httpOut } = await execAsync(
              `networksetup -getwebproxy "${networkService}"`
            );
            const { stdout: httpsOut } = await execAsync(
              `networksetup -getsecurewebproxy "${networkService}"`
            );
            const httpOn = /Enabled:\s*Yes/i.test(httpOut);
            const httpsOn = /Enabled:\s*Yes/i.test(httpsOut);
            enabledStatuses.push({ service: networkService, http: httpOn, https: httpsOn });
          } catch {}
        }
        const anyOn = enabledStatuses.some((s) => s.http || s.https);
        return { success: true, enabled: anyOn, details: enabledStatuses };
      } else if (process.platform === 'win32') {
        const command =
          'powershell -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\').ProxyEnable"';
        const { stdout } = await execAsync(command);
        const enabled = String(stdout || '').trim() === '1';
        return { success: true, enabled };
      } else {
        return { success: false, message: '不支持的操作系统' };
      }
    } catch (error) {
      return { success: false, message: `查询系统代理失败: ${(error as Error).message}` };
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
      // 直接开启实时捕获（通过进程输出与 API 轮询）
      // 不再依赖日志目录是否存在，否则会导致在某些环境下完全不采集
      logger.info('Starting real-time capture (without log dir dependency)...');
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
  }

  // 从Whistle API获取数据
  private async fetchWhistleData(port: number): Promise<void> {
    try {
      logger.debug('🔍 Fetching real Whistle data from API...');
      const raw = await this.getWhistleData(port);
      if (raw) {
        let jsonData: any = raw;
        if (typeof raw === 'string') {
          try {
            jsonData = JSON.parse(raw);
          } catch {}
        }

        // 如果是数组块格式且 data 块为空，但存在 newIds，则按 id 再拉一次详细数据
        if (Array.isArray(jsonData)) {
          const dataBlock = jsonData.find((b: any) => b && b.id === 'data');
          const newIdsBlock = jsonData.find((b: any) => b && b.id === 'newIds');
          const dataKeys = dataBlock
            ? Object.keys(dataBlock).filter((k: string) => k !== 'id')
            : [];
          const ids: string[] = newIdsBlock
            ? Object.keys(newIdsBlock)
                .filter((k: string) => k !== 'id')
                .map((k: string) => String(newIdsBlock[k]))
            : [];

          if (dataKeys.length === 0 && ids.length > 0) {
            logger.info(`ℹ️ Data block empty; fetching details by ids (${ids.length})...`);
            const detail = await this.getWhistleDataByIds(port, ids);
            if (detail) {
              this.parseWhistleNetworkData(detail);
              return;
            }
          }
        }

        // 优先解析当前数据
        const sessionsTry = this.extractWhistleSessions(jsonData);
        if (sessionsTry.length > 0) {
          // 若部分会话缺少响应体或状态码，按会话 id 回补一次详情
          try {
            const missingDetailIds = Array.from(
              new Set(
                sessionsTry
                  .map((s: any) => (s && s.id ? String(s.id) : ''))
                  .filter(Boolean)
                  .filter((id: string) => {
                    const s: any = sessionsTry.find((x: any) => String(x.id) === id) || {};
                    const hasBody = Boolean(s?.res?.body) || Boolean(s?.res?.base64);
                    const hasStatus =
                      typeof s?.res?.statusCode === 'number' || typeof s?.statusCode === 'number';
                    return !hasBody || !hasStatus;
                  })
              )
            );
            if (missingDetailIds.length > 0) {
              logger.info(
                `🔎 Some sessions missing details, fetching ${missingDetailIds.length} ids...`
              );
              const detail = await this.getWhistleDataByIds(port, missingDetailIds);
              if (detail) {
                this.parseWhistleNetworkData(detail);
                return;
              }
            }
          } catch {}
          this.processWhistleData(sessionsTry);
          return;
        }

        // 兜底：如果不是数组（通常是状态对象），尝试不带任何参数获取一次完整数据
        if (!Array.isArray(jsonData)) {
          logger.info(
            'No sessions in current response; trying fallback /cgi-bin/get-data without params...'
          );
          const fallbackRaw = await new Promise<any>((resolve) => {
            const options: http.RequestOptions = {
              hostname: '127.0.0.1',
              port,
              path: '/cgi-bin/get-data',
              method: 'GET',
              timeout: 2000,
            };
            const req = http.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => (data += chunk));
              res.on('end', () => {
                try {
                  resolve(JSON.parse(data));
                } catch {
                  resolve(null);
                }
              });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => {
              req.destroy();
              resolve(null);
            });
            req.end();
          });

          if (fallbackRaw) {
            const sessions2 = this.extractWhistleSessions(fallbackRaw);
            if (sessions2.length > 0) {
              logger.info(`Fallback fetched ${sessions2.length} sessions`);
              // 回补一次缺失详情再处理
              try {
                const missingIds = Array.from(
                  new Set(
                    sessions2
                      .map((s: any) => (s && s.id ? String(s.id) : ''))
                      .filter(Boolean)
                      .filter((id: string) => {
                        const s: any = sessions2.find((x: any) => String(x.id) === id) || {};
                        const hasBody = Boolean(s?.res?.body) || Boolean(s?.res?.base64);
                        const hasStatus =
                          typeof s?.res?.statusCode === 'number' ||
                          typeof s?.statusCode === 'number';
                        return !hasBody || !hasStatus;
                      })
                  )
                );
                if (missingIds.length > 0) {
                  const detail2 = await this.getWhistleDataByIds(port, missingIds);
                  if (detail2) {
                    this.parseWhistleNetworkData(detail2);
                    return;
                  }
                }
              } catch {}
              this.processWhistleData(sessions2);
              return;
            }
          }
        }

        // 最终解析（如果有的话）
        this.parseWhistleNetworkData(jsonData);
      } else {
        logger.warn('⚠️ No data returned from Whistle API');
      }
    } catch (error) {
      logger.error('❌ Failed to fetch Whistle data:', error);
    }
  }

  // 参考 whistle-client：统一以 HTTP 请求获取 JSON 的小工具
  private async getWhistleJson(port: number, path: string): Promise<any> {
    return new Promise((resolve) => {
      const options: http.RequestOptions = {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
        timeout: 16000,
      };
      const req = http.request(options, (res) => {
        if (res.statusCode !== 200) {
          try {
            res.resume();
          } catch {}
          return resolve(null);
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : null);
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        try {
          req.destroy();
        } catch {}
        resolve(null);
      });
      req.end();
    });
  }

  // 根据一组会话ID获取详细数据
  private async getWhistleDataByIds(port: number, ids: string[]): Promise<any> {
    if (!ids || ids.length === 0) return null;
    const path = `/cgi-bin/get-data?ids=${encodeURIComponent(ids.join(','))}`;
    return this.getWhistleJson(port, path);
  }

  // 获取Whistle的实际数据
  private async getWhistleData(port: number): Promise<any> {
    // 使用 lastId（会话ID）增量获取：优先使用 startId（更符合 whistle 语义）
    const path =
      this.lastWhistleId && this.lastWhistleId !== '0'
        ? `/cgi-bin/get-data?startId=${encodeURIComponent(this.lastWhistleId)}`
        : '/cgi-bin/get-data?startId=0';
    return this.getWhistleJson(port, path);
  }

  // 解析Whistle网络数据
  private parseWhistleNetworkData(data: any): void {
    try {
      // Whistle数据格式是一个JSON字符串，需要先解析
      let jsonData = data;
      if (typeof data === 'string') {
        jsonData = JSON.parse(data);
      }
      if (!jsonData) return;

      const sessionsToProcess = this.extractWhistleSessions(jsonData);
      if (!sessionsToProcess.length) {
        logger.warn('No sessions found in Whistle data structure');
        return;
      }
      this.processWhistleData(sessionsToProcess);
    } catch (error) {
      logger.error('Error parsing Whistle network data:', error);
    }
  }

  // 将 get-data 的响应结构归一化为会话数组（简化版）
  private extractWhistleSessions(jsonData: any): Array<{ id?: string; [k: string]: any }> {
    try {
      // 直接是数组则透传
      if (Array.isArray(jsonData)) return jsonData as any[];

      // 常见容器：sessions 或 data（data 为字典，需摊平）
      if (jsonData && typeof jsonData === 'object') {
        const root: any = jsonData;

        // 顶层 sessions
        if (Array.isArray(root.sessions)) return root.sessions as any[];

        // 顶层 data 对象
        if (root.data && typeof root.data === 'object') {
          const dataObj: any = root.data;

          // 如果存在 newIds，更新 lastWhistleId 以便增量拉取
          if (Array.isArray(dataObj.newIds) && dataObj.newIds.length > 0) {
            const last = String(dataObj.newIds[dataObj.newIds.length - 1]);
            this.lastWhistleId = last;
          }

          // 优先处理 data.data（真正的会话字典）
          if (dataObj.data && typeof dataObj.data === 'object') {
            const out: any[] = [];
            for (const [k, v] of Object.entries(dataObj.data)) {
              if (!v || typeof v !== 'object') continue;
              out.push({ id: k, ...(v as any) });
            }
            return out;
          }

          // 退化：摊平 data 对象，跳过元数据键
          const out2: any[] = [];
          for (const [k, v] of Object.entries(dataObj)) {
            if (k === 'id' || k === 'ids' || k === 'tunnelIps' || k === 'newIds' || k === 'data')
              continue;
            if (!v || typeof v !== 'object') continue;
            out2.push({ id: k, ...(v as any) });
          }
          if (out2.length) return out2;
        }
      }
    } catch {}
    return [];
  }

  private processWhistleData(data: any[]): void {
    if (!Array.isArray(data)) return;

    data.forEach((item: any) => {
      if (!item || typeof item !== 'object') return;

      // 跳过错误项与元数据块
      if (item.captureError || item.reqError) return;
      if (
        item.id === 'ids' ||
        item.id === 'tunnelIps' ||
        item.id === 'newIds' ||
        item.id === 'data'
      )
        return;

      // 计算 URL（尽量健壮）
      const inferredUrl =
        item.url ||
        item.req?.url ||
        (item.req?.headers?.host
          ? `${item.useH2 || item.isHttps || item.port === 443 ? 'https' : 'http'}://${item.req.headers.host}${item.req?.path || ''}`
          : '');

      // 跳过无效/特殊协议
      if (
        !inferredUrl ||
        inferredUrl.startsWith('data:') ||
        inferredUrl.startsWith('chrome-extension:') ||
        inferredUrl.startsWith('blob:')
      ) {
        return;
      }

      // 生成稳定的 id，优先使用 whistle 的会话 id
      const stableId = String(
        item.id ||
          item.req?.id ||
          `${item.startTime || Date.now()}-${(item.req?.method || 'GET').toUpperCase()}-${item.req?.headers?.host || this.extractHost(inferredUrl) || ''}-${item.req?.path || ''}`
      );

      // 忽略清空前的旧数据
      const itemStartTime = this.toEpochMs(item.startTime);
      if (this.clearedAtMs && itemStartTime > 0 && itemStartTime < this.clearedAtMs) {
        return;
      }

      const request: CapturedRequest = {
        id: stableId,
        timestamp: new Date(item.startTime || Date.now()).toISOString(),
        method: (item.req?.method || 'GET').toUpperCase(),
        url: inferredUrl,
        host: this.extractHost(inferredUrl) || item.req?.headers?.host || '',
        protocol:
          this.extractProtocol(inferredUrl) ||
          (item.useH2 || item.isHttps || item.port === 443 ? 'https' : 'http'),
        statusCode: item.res?.statusCode || item.statusCode || 0,
        requestHeaders: this.parseHeaders(item.req?.headers),
        responseHeaders: this.parseHeaders(item.res?.headers),
        requestBody: this.extractBody(item.req) || '',
        responseBody:
          (typeof item.res?.body === 'string' && item.res.body) ||
          (typeof item.res?.base64 === 'string' && this.extractBody(item.res)) ||
          this.extractBody(item.res) ||
          '',
        duration:
          item.duration ||
          item.ttfb ||
          (item.endTime && item.startTime ? item.endTime - item.startTime : 0),
      };

      // 去重或合并：若已存在则合并缺失字段
      const exists = this.capturedData.find((ex) => ex.id === request.id);
      if (!exists) {
        this.addCapturedRequest(request);
      } else {
        this.mergeCapturedRequestFields(exists, request);
        this.emit('dataUpdate', this.capturedData);
      }
    });
  }

  private parseHeaders(headers: any): Record<string, string> {
    if (!headers || typeof headers !== 'object') return {};
    const out: Record<string, string> = {};
    Object.keys(headers).forEach((k) => {
      const v: any = (headers as any)[k];
      out[String(k).toLowerCase()] = Array.isArray(v) ? String(v[0]) : String(v);
    });
    return out;
  }

  private extractHost(url: string | undefined): string {
    if (!url) return '';
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  private extractProtocol(url: string | undefined): string {
    if (!url) return '';
    try {
      return new URL(url).protocol.replace(':', '');
    } catch {
      return '';
    }
  }

  private extractBody(part: any): string {
    if (!part) return '';

    const headers: Record<string, any> = (part.headers || {}) as any;
    const contentType: string = String(headers['content-type'] || headers['Content-Type'] || '');
    const contentEncoding: string = String(
      headers['content-encoding'] || headers['Content-Encoding'] || ''
    );

    if (typeof part.body === 'string' && part.body.length > 0) {
      return part.body;
    }

    if (typeof part.base64 === 'string' && part.base64.length > 0) {
      try {
        let buf: Buffer = Buffer.from(part.base64, 'base64');
        // 解压缩
        try {
          if (contentEncoding.includes('gzip')) buf = Buffer.from(zlib.gunzipSync(buf));
          else if (contentEncoding.includes('deflate')) buf = Buffer.from(zlib.inflateSync(buf));
          else if (contentEncoding.includes('br'))
            buf = Buffer.from(zlib.brotliDecompressSync(buf));
        } catch {
          // 解压失败则按原始处理
        }

        // 文本类型则转成utf8并做清洗（去掉 JSONP 包装等）
        if (this.isTextContentType(contentType)) {
          const text = buf.toString('utf8');
          const cleaned = this.sanitizeTextBody(text);
          return cleaned.length > 200_000 ? cleaned.slice(0, 200_000) + '...[truncated]' : cleaned;
        }

        // 非文本，返回原始 base64 字符串，便于上游需要时解码
        return part.base64 as string;
      } catch {
        // 解码失败，仍返回原始 base64
        return part.base64 as string;
      }
    }

    return '';
  }

  private isTextContentType(ct: string): boolean {
    const lower = (ct || '').toLowerCase();
    if (!lower) return false;
    return (
      lower.startsWith('text/') ||
      lower.includes('json') ||
      lower.includes('javascript') ||
      lower.includes('xml') ||
      lower.includes('html') ||
      lower.includes('csv') ||
      lower.includes('form-urlencoded')
    );
  }

  // 去除 JSONP/函数包装，例如: jsonpgz({...}); → {...}
  private sanitizeTextBody(text: string): string {
    const trimmed = (text || '').trim();
    // 快速路径：若以 jsonpgz( 开头，优先处理
    const jsonpgzPrefix = /^jsonpgz\s*\(/i;
    if (jsonpgzPrefix.test(trimmed)) {
      const inner = this.extractWrappedJson(trimmed);
      if (inner) return inner;
    }

    // 一般 JSONP：callbackName({...});
    const jsonpMatch = /^[$A-Z_][0-9A-Z_$]*\s*\((.*)\)\s*;?$/i.exec(trimmed);
    if (jsonpMatch) {
      const candidate = jsonpMatch[1].trim();
      const extracted = this.tryParseAndStringify(candidate);
      if (extracted) return extracted;
      return candidate; // 解析失败，直接去壳返回
    }

    return trimmed;
  }

  private extractWrappedJson(wrapped: string): string | null {
    // 仅去掉最外层 函数( ... ) 包装
    const m = /^\s*[$A-Z_][0-9A-Z_$]*\s*\((.*)\)\s*;?\s*$/i.exec(wrapped);
    if (!m) return null;
    const inner = m[1].trim();
    return this.tryParseAndStringify(inner) || inner;
  }

  private tryParseAndStringify(raw: string): string | null {
    try {
      // 只在看起来像 JSON 时尝试解析
      const looksJson = /^(\{[\s\S]*\}|\[[\s\S]*\])$/.test(raw.trim());
      if (!looksJson) return null;
      const obj = JSON.parse(raw);
      return JSON.stringify(obj);
    } catch {
      return null;
    }
  }

  // 处理单个Whistle会话
  private processWhistleSession(session: any, sessionId: string): void {
    try {
      // 检查是否已经处理过这个请求
      const existingRequest = this.capturedData.find((req) => req.id === sessionId);

      if (existingRequest) return; // 已经存在，跳过

      // 忽略清空前的旧数据
      const itemStartTime = this.toEpochMs(session.startTime);
      if (this.clearedAtMs && itemStartTime > 0 && itemStartTime < this.clearedAtMs) {
        return;
      }

      const computedUrl =
        session.url ||
        session.req?.url ||
        (session.req?.headers?.host
          ? `${session.useH2 || session.isHttps || session.port === 443 ? 'https' : 'http'}://${session.req.headers.host}${session.req?.path || ''}`
          : '');

      if (
        !computedUrl ||
        computedUrl.startsWith('data:') ||
        computedUrl.startsWith('chrome-extension:') ||
        computedUrl.startsWith('blob:')
      ) {
        return; // 跳过特殊协议
      }

      let urlObj: URL;
      try {
        urlObj = new URL(computedUrl);
      } catch (error) {
        logger.debug('Invalid URL:', computedUrl);
        return;
      }

      // 根据实际的Whistle数据结构构造请求
      const request: CapturedRequest = {
        id: sessionId,
        timestamp: new Date(session.startTime || Date.now()).toISOString(),
        method: (session.req?.method || 'GET').toUpperCase(),
        url: computedUrl,
        host: urlObj.hostname,
        protocol: urlObj.protocol.replace(':', ''),
        statusCode:
          session.res?.statusCode || session.statusCode || (session.res?.statusMessage ? 200 : 0),
        requestHeaders: session.req?.headers || {},
        responseHeaders: session.res?.headers || {},
        requestBody: session.req?.body === false ? '' : session.req?.body || '',
        responseBody: session.res?.body === false ? '' : session.res?.body || '',
        duration:
          session.ttfb ||
          (session.endTime && session.startTime ? session.endTime - session.startTime : 0),
      };
      this.addCapturedRequest(request);
      logger.info(
        `✅ Captured real request: ${request.method} ${request.url} [${request.statusCode}]`
      );
    } catch (error) {
      logger.error('Error processing Whistle session:', error, 'SessionID:', sessionId);
    }
  }

  // 解析Whistle输出获取请求信息
  private parseWhistleOutput(output: string): void {
    // 简单的日志解析示例
    // 实际实现需要根据Whistle的具体日志格式来解析
    try {
      const lines = output.split('\n');
      lines.forEach((line) => {
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
