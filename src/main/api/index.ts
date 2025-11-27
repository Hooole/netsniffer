import { BrowserWindow, ipcMain, shell, app, dialog } from 'electron';
import logger from 'electron-log';
import { ProxyService } from '../core/proxy-service';
import { CertificateService } from '../core/certificate-service';
import * as fs from 'fs-extra';

let proxyService: ProxyService;
let certificateService: CertificateService;
let mainWindow: BrowserWindow;

export async function initAPI(window: BrowserWindow): Promise<void> {
  mainWindow = window;
  proxyService = new ProxyService();
  certificateService = new CertificateService();

  setupProxyAPI();
  setupCaptureAPI();
  setupCertificateAPI();
  setupSystemAPI();

  // 监听数据更新事件
  proxyService.on('dataUpdate', (data) => {
    logger.info(`🚀 Sending dataUpdate to renderer with ${data.length} requests`);
    logger.info(`📤 Data sample:`, data.slice(0, 2)); // 只记录前两个请求作为样本
    mainWindow.webContents.send('capture:dataUpdate', data);
  });

  // 当主进程清空数据时，立即通知渲染进程置空
  proxyService.on('dataCleared', () => {
    logger.info('🧹 Captured data cleared, notifying renderer');
    mainWindow.webContents.send('capture:dataUpdate', []);
  });

  logger.info('API initialized successfully');

  // 应用启动即尝试启动 Whistle（不设置系统代理）
  try {
    await proxyService.start({
      port: 7890,
      host: '127.0.0.1',
      enableCapture: false, // 不改系统代理，仅启动服务
      enableHttps: true,
      filter: '',
    } as any);
    logger.info('Whistle auto-started on app launch (without system proxy)');
  } catch (e) {
    // 若已启动或端口占用，忽略错误
    logger.warn('Auto-start whistle skipped:', (e as Error)?.message || e);
  }
}

function setupProxyAPI(): void {
  ipcMain.handle('proxy:start', async (_, config) => {
    try {
      await proxyService.start(config);
      return { success: true, message: 'Proxy started successfully' };
    } catch (error) {
      logger.error('Failed to start proxy:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('proxy:stop', async () => {
    try {
      await proxyService.stop();
      return { success: true, message: 'Proxy stopped successfully' };
    } catch (error) {
      logger.error('Failed to stop proxy:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('proxy:getStatus', async () => {
    try {
      const status = proxyService.getStatus();
      return { success: true, data: status };
    } catch (error) {
      logger.error('Failed to get proxy status:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  // 新增：设置系统代理
  ipcMain.handle('proxy:setSystemProxy', async (_event, config) => {
    try {
      const host = config?.host || '127.0.0.1';
      const port = Number(config?.port);
      if (!port || Number.isNaN(port)) {
        return { success: false, message: 'Invalid port' };
      }
      const result = await proxyService.setSystemProxy(host, port);
      return result;
    } catch (error) {
      logger.error('Failed to set system proxy:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  // 新增：清理系统代理
  ipcMain.handle('proxy:clearSystemProxy', async () => {
    try {
      const result = await proxyService.clearSystemProxy();
      return result;
    } catch (error) {
      logger.error('Failed to clear system proxy:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  // 查询系统代理状态
  ipcMain.handle('proxy:getSystemProxyStatus', async () => {
    try {
      const result = await proxyService.getSystemProxyStatus();
      return result;
    } catch (error) {
      logger.error('Failed to get system proxy status:', error);
      return { success: false, message: (error as Error).message };
    }
  });
}

function setupCaptureAPI(): void {
  ipcMain.handle('capture:getCapturedData', async () => {
    try {
      const data = proxyService.getCapturedData();
      return { success: true, data };
    } catch (error) {
      logger.error('Failed to get captured data:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  // 新增：直接拉取 Whistle 一次快照（包含缺字段按 id 回补）
  ipcMain.handle('capture:fetchWhistleSnapshot', async () => {
    try {
      const data = await proxyService.fetchWhistleSnapshot();
      return { success: true, data };
    } catch (error) {
      logger.error('Failed to fetch whistle snapshot:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  // 新增：直接返回 Whistle 原始数据（页面自行处理）
  ipcMain.handle('capture:getWhistleRaw', async (_e, options) => {
    try {
      const data = await proxyService.getWhistleRaw(options || {});
      return { success: true, data };
    } catch (error) {
      logger.error('Failed to get whistle raw:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  // 新增：重置增量游标
  ipcMain.handle('capture:resetWhistleCursor', async () => {
    try {
      proxyService.resetWhistleCursor();
      return { success: true };
    } catch (error) {
      logger.error('Failed to reset whistle cursor:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('capture:clearCapturedData', async () => {
    try {
      proxyService.clearCapturedData();
      // 立即广播空列表，确保前端立刻清空
      try {
        mainWindow.webContents.send('capture:dataUpdate', []);
      } catch {}
      return { success: true, message: 'Captured data cleared' };
    } catch (error) {
      logger.error('Failed to clear captured data:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('capture:exportData', async (_, format) => {
    try {
      const data = proxyService.getCapturedData();
      const isCSV = String(format).toLowerCase() === 'csv';

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultName = `capture-data-${timestamp}.${isCSV ? 'csv' : 'json'}`;

      const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出抓包数据',
        defaultPath: defaultName,
        filters: isCSV
          ? [{ name: 'CSV 文件', extensions: ['csv'] }]
          : [{ name: 'JSON 文件', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, message: '用户取消导出' };
      }

      if (isCSV) {
        const header = ['timestamp', 'method', 'statusCode', 'protocol', 'host', 'url', 'duration'];
        const esc = (v: any) => {
          if (v === undefined || v === null) return '';
          const s = String(v).replace(/"/g, '""').replace(/\n|\r/g, ' ');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        };
        const rows = data.map((r) =>
          [r.timestamp, r.method, r.statusCode ?? '', r.protocol, r.host, r.url, r.duration ?? '']
            .map(esc)
            .join(',')
        );
        const csv = [header.join(','), ...rows].join('\n');
        await fs.outputFile(result.filePath, csv, 'utf8');
      } else {
        await fs.outputJson(result.filePath, data, { spaces: 2 });
      }

      logger.info('Exported capture data to', result.filePath);
      return { success: true, message: '数据导出成功', path: result.filePath };
    } catch (error) {
      logger.error('Failed to export data:', error);
      return { success: false, message: (error as Error).message };
    }
  });
}

function setupCertificateAPI(): void {
  ipcMain.handle('certificate:getStatus', async () => {
    try {
      const status = await certificateService.getStatus();
      return { success: true, data: status };
    } catch (error) {
      logger.error('Failed to get certificate status:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('certificate:install', async () => {
    try {
      await certificateService.install();
      return { success: true, message: 'Certificate installed successfully' };
    } catch (error) {
      logger.error('Failed to install certificate:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('certificate:uninstall', async () => {
    try {
      await certificateService.uninstall();
      return { success: true, message: 'Certificate uninstalled successfully' };
    } catch (error) {
      logger.error('Failed to uninstall certificate:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('certificate:openFile', async () => {
    try {
      await certificateService.openFile();
      return { success: true, message: 'Certificate file opened' };
    } catch (error) {
      logger.error('Failed to open certificate file:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('certificate:generate', async () => {
    try {
      await certificateService.generate();
      return { success: true, message: 'Certificate generated successfully' };
    } catch (error) {
      logger.error('Failed to generate certificate:', error);
      return { success: false, message: (error as Error).message };
    }
  });
}

function setupSystemAPI(): void {
  ipcMain.handle('system:openExternal', async (_, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      logger.error('Failed to open external URL:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('system:showItemInFolder', async (_, path) => {
    try {
      shell.showItemInFolder(path);
      return { success: true };
    } catch (error) {
      logger.error('Failed to show item in folder:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('system:getVersion', async () => {
    return { success: true, data: app.getVersion() };
  });

  ipcMain.handle('system:getPlatform', async () => {
    return { success: true, data: process.platform };
  });
}

// 新增：提供在应用退出时的统一清理入口
export async function shutdownAPI(): Promise<void> {
  try {
    if (proxyService) {
      await proxyService.stop();
    }
  } catch (error) {
    logger.error('Failed to shutdown proxy on app exit:', error);
  }
}
