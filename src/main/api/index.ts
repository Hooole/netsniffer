import { BrowserWindow, ipcMain, shell, app } from 'electron';
import logger from 'electron-log';
import { ProxyService } from '../core/proxy-service';
import { CertificateService } from '../core/certificate-service';

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
    mainWindow.webContents.send('capture:dataUpdate', data);
  });

  logger.info('API initialized successfully');
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

  ipcMain.handle('capture:clearCapturedData', async () => {
    try {
      proxyService.clearCapturedData();
      return { success: true, message: 'Captured data cleared' };
    } catch (error) {
      logger.error('Failed to clear captured data:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('capture:exportData', async (_, format) => {
    try {
      // TODO: 实现数据导出功能
      return { success: true, message: `Data exported as ${format}` };
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