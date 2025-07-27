const { app, BrowserWindow } = require('electron');
const path = require('path');

// 导入主进程模块
const { createMainWindow } = require('./src/main/main');
const { setupIpcHandlers } = require('./src/main/ipc-handlers');

let mainWindow;

// 应用准备就绪时创建窗口
app.whenReady().then(() => {
  mainWindow = createMainWindow();
  setupIpcHandlers(mainWindow);
});

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用激活时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    setupIpcHandlers(mainWindow);
  }
}); 