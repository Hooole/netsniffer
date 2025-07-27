const { BrowserWindow } = require('electron');
const path = require('path');

/**
 * 创建主窗口
 * @returns {BrowserWindow} 主窗口实例
 */
function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    title: 'NetSniffer',
    show: false, // 先隐藏窗口，等加载完成后再显示
    minWidth: 800,
    minHeight: 600
  });

  // 开发模式下加载前端开发服务器
  if (process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式下加载构建后的文件
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 窗口关闭时清理资源
  mainWindow.on('closed', () => {
    // 窗口关闭时的清理工作
  });

  return mainWindow;
}

module.exports = {
  createMainWindow
}; 