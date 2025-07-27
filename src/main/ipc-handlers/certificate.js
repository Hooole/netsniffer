const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const { CertificateManager } = require('../../core/certificate-manager');

const execAsync = promisify(exec);

let certificateManager = null;

/**
 * 设置证书管理相关IPC处理器
 */
function setup() {
  // 初始化证书管理器
  certificateManager = new CertificateManager();

  // 安装证书
  ipcMain.handle('install-certificate', async () => {
    try {
      console.log('开始安装证书...');
      const result = await certificateManager.installCertificate();
      console.log('证书安装结果:', result);
      return result;
    } catch (error) {
      console.error('证书安装失败:', error);
      return { success: false, message: error.message };
    }
  });

  // 获取证书状态
  ipcMain.handle('get-certificate-status', async () => {
    try {
      const result = await certificateManager.getCertificateInfo();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 打开证书文件
  ipcMain.handle('open-certificate-file', async () => {
    try {
      // 使用项目根目录下的certs文件夹
      const certPath = path.join(__dirname, '..', '..', '..', 'certs', 'rootCA.crt');
      console.log('尝试打开证书文件:', certPath);
      
      if (await fs.pathExists(certPath)) {
        console.log('证书文件存在，正在打开...');
        
        // 根据平台使用不同的打开方式
        if (process.platform === 'darwin') {
          // macOS: 使用open命令
          await execAsync(`open "${certPath}"`);
        } else if (process.platform === 'win32') {
          // Windows: 使用start命令
          await execAsync(`start "" "${certPath}"`);
        } else {
          // Linux: 使用xdg-open命令
          await execAsync(`xdg-open "${certPath}"`);
        }
        
        return { success: true, message: '已打开证书文件' };
      } else {
        console.log('证书文件不存在:', certPath);
        return { success: false, message: '证书文件不存在' };
      }
    } catch (error) {
      console.error('打开证书文件失败:', error);
      return { success: false, message: `打开证书文件失败: ${error.message}` };
    }
  });
}

module.exports = {
  setup
}; 