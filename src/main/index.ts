import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import isDev from 'electron-is-dev';
import logger from 'electron-log';
import { initAPI } from './api';
import { createWindow } from './window';

// 配置日志
logger.transports.file.level = 'info';
logger.transports.console.level = 'debug';

// 禁用硬件加速，避免渲染问题
app.disableHardwareAcceleration();

// 确保单实例运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，聚焦到主窗口
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWindow = windows[0];
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let mainWindow: BrowserWindow | null = null;

async function createMainWindow(): Promise<void> {
  try {
    // 创建主窗口
    mainWindow = createWindow();
    
    // 初始化IPC API
    await initAPI(mainWindow);
    
    // 加载应用
    const isDevMode = process.argv.includes('--dev');
    logger.info('Is development mode:', isDevMode);
    
    if (isDevMode) {
      logger.info('Loading development server...');
      await mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } else {
      logger.info('Loading production build...');
      const htmlPath = path.join(__dirname, 'index.html');
      logger.info('HTML path:', htmlPath);
      await mainWindow.loadFile(htmlPath);
    }
    
    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Failed to create main window:', error);
    app.quit();
  }
}

// 应用就绪时创建窗口
app.whenReady().then(createMainWindow);

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用激活时重新创建窗口（macOS）
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// 处理未捕获异常
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});