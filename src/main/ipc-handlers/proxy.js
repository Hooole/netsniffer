const { ipcMain } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 代理管理器
 */
class ProxyManager {
  constructor() {}

  /**
   * 设置系统代理
   * @param {string} host 代理主机
   * @param {number} port 代理端口
   * @returns {Promise<Object>} 设置结果
   */
  async setSystemProxy(host = '127.0.0.1', port = 7788) {
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
   * 清除系统代理
   * @returns {Promise<Object>} 清除结果
   */
  async clearSystemProxy() {
    try {
      if (process.platform === 'darwin') {
        const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
        const serviceLines = services.split('\n').filter(line => line.trim() && !line.includes('*'));
        
        if (serviceLines.length === 0) {
          return { success: false, message: '未找到网络服务' };
        }

        const networkService = serviceLines[0];
        
        // 关闭代理
        await execAsync(`networksetup -setwebproxystate "${networkService}" off`);
        await execAsync(`networksetup -setsecurewebproxystate "${networkService}" off`);

        return { success: true, message: '系统代理已清除' };
      } else if (process.platform === 'win32') {
        const command = `powershell -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 0"`;
        await execAsync(command);
        return { success: true, message: '系统代理已清除' };
      } else {
        return { success: false, message: '不支持的操作系统' };
      }
    } catch (error) {
      return { success: false, message: `清除代理失败: ${error.message}` };
    }
  }

  /**
   * 获取当前代理设置
   * @returns {Promise<Object>} 代理设置信息
   */
  async getCurrentProxy() {
    try {
      if (process.platform === 'darwin') {
        const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
        const serviceLines = services.split('\n').filter(line => line.trim() && !line.includes('*'));
        
        if (serviceLines.length === 0) {
          return { success: false, message: '未找到网络服务' };
        }

        const networkService = serviceLines[0];
        
        // 获取HTTP代理设置
        const { stdout: httpProxy } = await execAsync(`networksetup -getwebproxy "${networkService}"`);
        
        // 获取HTTPS代理设置
        const { stdout: httpsProxy } = await execAsync(`networksetup -getsecurewebproxy "${networkService}"`);

        return { 
          success: true, 
          data: {
            networkService,
            httpProxy: this.parseMacOSProxyOutput(httpProxy),
            httpsProxy: this.parseMacOSProxyOutput(httpsProxy)
          }
        };
      } else if (process.platform === 'win32') {
        const command = `powershell -Command "Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' | Select-Object ProxyEnable, ProxyServer"`;
        const { stdout } = await execAsync(command);
        return { 
          success: true, 
          data: {
            output: stdout
          }
        };
      } else {
        return { success: false, message: '不支持的操作系统' };
      }
    } catch (error) {
      return { success: false, message: `获取代理设置失败: ${error.message}` };
    }
  }

  /**
   * 解析macOS代理输出
   * @param {string} output 命令输出
   * @returns {Object} 解析结果
   */
  parseMacOSProxyOutput(output) {
    const lines = output.split('\n');
    const result = {};
    
    lines.forEach(line => {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key && value) {
        result[key] = value;
      }
    });
    
    return result;
  }
}

let proxyManager = null;

/**
 * 设置代理管理相关IPC处理器
 * @param {BrowserWindow} mainWindow 主窗口实例
 */
function setup(mainWindow) {
  // 初始化代理管理器
  proxyManager = new ProxyManager();

  // 获取当前代理设置
  ipcMain.handle('get-current-proxy', async () => {
    try {
      const result = await proxyManager.getCurrentProxy();
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 手动设置代理
  ipcMain.handle('set-proxy', async (event, config) => {
    try {
      const host = config.host || '127.0.0.1';
      const port = config.port || 7788;
      const result = await proxyManager.setSystemProxy(host, port);
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 手动清除代理
  ipcMain.handle('clear-proxy', async () => {
    try {
      const result = await proxyManager.clearSystemProxy();
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
}

module.exports = {
  setup
}; 