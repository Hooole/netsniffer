import { BrowserWindow } from 'electron';
import * as path from 'path';
import windowStateKeeper from 'electron-window-state';

export function createWindow(): BrowserWindow {
  // 保存窗口状态
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  });

  const window = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,

      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // 开发时允许加载本地资源
      sandbox: false, // 确保预加载脚本能正常工作
    },
    icon: path.join(__dirname, '../../assets/images/icon.png'),
  });

  // 让窗口状态管理器管理这个窗口
  mainWindowState.manage(window);

  // 窗口准备就绪后显示
  window.once('ready-to-show', () => {
    window.show();
    
    // macOS下激活应用
    if (process.platform === 'darwin') {
      window.moveTop();
    }
  });

  // 防止页面导航（只在开发模式下限制）
  const isDevMode = process.argv.includes('--dev');
  if (isDevMode) {
    window.webContents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== 'http://localhost:3000') {
        event.preventDefault();
      }
    });
  }

  return window;
}