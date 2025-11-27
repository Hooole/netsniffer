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
      webSecurity: false, // 允许加载本地资源
      sandbox: false, // 确保预加载脚本能正常工作
      allowRunningInsecureContent: true, // 允许不安全内容
    },
    // Windows 需使用 .ico；打包后从 resources 根目录读取（通过 extraResources 复制）
    icon:
      process.platform === 'win32'
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(__dirname, '../src/assets/icon.png'),
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
