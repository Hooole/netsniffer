const { ipcMain } = require('electron');

// 导入各个IPC处理器模块
const captureHandlers = require('./capture');
const certificateHandlers = require('./certificate');
const proxyHandlers = require('./proxy');

/**
 * 设置所有IPC处理器
 * @param {BrowserWindow} mainWindow 主窗口实例（可选）
 */
function setupIpcHandlers(mainWindow) {
  // 设置抓包相关IPC处理器（需要mainWindow用于文件对话框）
  captureHandlers.setup(mainWindow);
  
  // 设置证书管理相关IPC处理器
  certificateHandlers.setup();
  
  // 设置代理管理相关IPC处理器
  proxyHandlers.setup();
}

module.exports = {
  setupIpcHandlers
}; 