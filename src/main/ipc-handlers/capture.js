const { ipcMain, dialog } = require('electron');
const { WhistleProxyServer } = require('../../core/whistle-proxy-server');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

let proxyServer = null;

/**
 * 设置系统代理
 */
async function setSystemProxy(host, port) {
  try {
    if (process.platform === 'darwin') {
      // 获取当前网络服务名称
      const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
      const serviceLines = services.split('\n').filter(line => line.trim() && !line.includes('*'));
      
      if (serviceLines.length === 0) {
        return { success: false, message: '未找到网络服务' };
      }

      const networkService = serviceLines[0];
      console.log(`使用网络服务: ${networkService}`);

      // 设置HTTP代理
      await execAsync(`networksetup -setwebproxy "${networkService}" ${host} ${port}`);
      
      // 设置HTTPS代理
      await execAsync(`networksetup -setsecurewebproxy "${networkService}" ${host} ${port}`);
      
      // 启用代理
      await execAsync(`networksetup -setwebproxystate "${networkService}" on`);
      await execAsync(`networksetup -setsecurewebproxystate "${networkService}" on`);

      return { 
        success: true, 
        message: `系统代理已设置为 ${host}:${port}`,
        networkService: networkService
      };
    } else if (process.platform === 'win32') {
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
    return { success: false, message: `设置代理失败: ${error.message}` };
  }
}

/**
 * 设置抓包相关IPC处理器
 * @param {BrowserWindow} mainWindow 主窗口实例（可选）
 */
function setup(mainWindow) {
  // 开始抓包
  ipcMain.handle('start-capture', async (event, config) => {
    try {
      console.log('开始启动抓包服务...');
      console.log('配置参数:', config);
      
      if (!proxyServer) {
        console.log('创建新的代理服务器实例...');
        proxyServer = new WhistleProxyServer();
      }
      
      console.log('启动代理服务器...');
      await proxyServer.start(config);
      console.log('代理服务器启动成功');
      
      // 自动设置系统代理
      const proxyHost = '127.0.0.1';
      const proxyPort = config.port || 7788;
      console.log('设置系统代理...');
      const proxyResult = await setSystemProxy(proxyHost, proxyPort);
      console.log('系统代理设置结果:', proxyResult);
      
      return { 
        success: true, 
        message: '抓包服务已启动',
        proxySet: proxyResult.success
      };
    } catch (error) {
      console.error('启动抓包服务失败:', error);
      console.error('错误堆栈:', error.stack);
      return { success: false, message: error.message };
    }
  });

  // 停止抓包
  ipcMain.handle('stop-capture', async () => {
    try {
      if (proxyServer) {
        await proxyServer.stop();
        proxyServer = null;
      }
      
      // 清除系统代理
      try {
        if (process.platform === 'darwin') {
          const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
          const serviceLines = services.split('\n').filter(line => line.trim() && !line.includes('*'));
          
          if (serviceLines.length > 0) {
            const networkService = serviceLines[0];
            await execAsync(`networksetup -setwebproxystate "${networkService}" off`);
            await execAsync(`networksetup -setsecurewebproxystate "${networkService}" off`);
          }
        } else if (process.platform === 'win32') {
          const command = `powershell -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 0"`;
          await execAsync(command);
        }
        console.log('系统代理已清除');
      } catch (proxyError) {
        console.error('清除系统代理失败:', proxyError);
      }
      
      return { success: true, message: '抓包服务已停止' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 获取抓包数据
  ipcMain.handle('get-captured-data', () => {
    try {
      if (proxyServer) {
        const data = proxyServer.getCapturedData();
        // 验证数据可以被序列化
        JSON.stringify(data);
        return { success: true, data: data };
      }
      return { success: true, data: [] };
    } catch (error) {
      console.error('获取抓包数据失败:', error);
      return { success: false, data: [], message: error.message };
    }
  });

  // 导出数据
  ipcMain.handle('export-data', async (event, format) => {
    try {
      if (!proxyServer) {
        throw new Error('抓包服务未启动');
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `capture-data-${timestamp}.${format}`;
      
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出抓包数据',
        defaultPath: fileName,
        filters: [
          { name: 'JSON文件', extensions: ['json'] },
          { name: 'CSV文件', extensions: ['csv'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });

      if (!result.canceled) {
        await proxyServer.exportData(result.filePath, format);
        return { success: true, message: '数据导出成功' };
      } else {
        return { success: false, message: '用户取消导出' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 获取Whistle状态
  ipcMain.handle('get-whistle-status', async () => {
    try {
      if (proxyServer) {
        const status = await proxyServer.getWhistleStatus();
        return { success: true, data: status };
      }
      return { success: false, message: 'Whistle服务器未启动' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 清除抓包数据
  ipcMain.handle('clear-captured-data', () => {
    try {
      if (proxyServer) {
        proxyServer.clearData();
        return { success: true, message: '数据已清除' };
      }
      return { success: false, message: 'Whistle服务器未启动' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
}

module.exports = {
  setup
}; 