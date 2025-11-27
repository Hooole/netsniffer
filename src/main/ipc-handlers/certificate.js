const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const { CertificateManager } = require('../../core/certificate-manager');

const execAsync = promisify(exec);

// 添加使用Node.js内置模块打开文件的方法
async function openFileWithNode(filePath) {
  try {
    console.log('使用Node.js打开文件:', filePath);
    
    // 使用Node.js的child_process模块
    const { spawn } = require('child_process');
    
    if (process.platform === 'darwin') {
      // macOS
      spawn('open', [filePath]);
      return true;
    } else if (process.platform === 'win32') {
      // Windows - 尝试多种方法
      
      // 方法1: 使用cmd /c start（最可靠）
      try {
        spawn('cmd', ['/c', 'start', '', filePath], { 
          shell: true,
          stdio: 'ignore'  // 忽略输出，避免阻塞
        });
        console.log('使用cmd /c start打开文件成功');
        return true;
      } catch (cmdError) {
        console.log('cmd /c start失败:', cmdError.message);
        
        // 方法2: 使用PowerShell
        try {
          spawn('powershell', ['-Command', `Start-Process -FilePath '${filePath}'`], {
            stdio: 'ignore'
          });
          console.log('使用PowerShell打开文件成功');
          return true;
        } catch (psError) {
          console.log('PowerShell失败:', psError.message);
          
          // 方法3: 使用rundll32
          try {
            spawn('rundll32', ['url.dll,FileProtocolHandler', filePath], {
              stdio: 'ignore'
            });
            console.log('使用rundll32打开文件成功');
            return true;
          } catch (rundllError) {
            console.log('rundll32失败:', rundllError.message);
            
            // 方法4: 使用explorer
            try {
              spawn('explorer', [filePath], {
                stdio: 'ignore'
              });
              console.log('使用explorer打开文件成功');
              return true;
            } catch (explorerError) {
              console.log('explorer失败:', explorerError.message);
              return false;
            }
          }
        }
      }
    } else {
      // Linux
      spawn('xdg-open', [filePath]);
      return true;
    }
  } catch (error) {
    console.error('使用Node.js打开文件失败:', error);
    return false;
  }
}

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
      // 在打包后的环境中，证书文件在resources目录中
      let certPath;
      if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        // 开发环境：使用项目根目录下的certs文件夹
        certPath = path.join(__dirname, '..', '..', '..', 'certs', 'rootCA.crt');
      } else {
        // 生产环境：使用resources目录
        certPath = path.join(process.resourcesPath, 'certs', 'rootCA.crt');
      }
      
      console.log('尝试打开证书文件:', certPath);
      
      // 检查证书文件是否存在
      if (!await fs.pathExists(certPath)) {
        console.log('证书文件不存在，尝试其他路径');
        
        // 尝试查找证书文件的其他可能位置
        const possiblePaths = [
          path.join(process.resourcesPath, 'certs', 'rootCA.crt'),
          path.join(__dirname, '..', '..', 'certs', 'rootCA.crt'),
          path.join(process.cwd(), 'certs', 'rootCA.crt'),
          path.join(__dirname, '..', '..', '..', 'certs', 'rootCA.crt'),
        ];
        
        console.log('尝试其他可能的路径:');
        for (const altPath of possiblePaths) {
          const exists = await fs.pathExists(altPath);
          console.log(`  ${altPath}: ${exists ? '✅' : '❌'}`);
          if (exists) {
            certPath = altPath;
            console.log('找到证书文件:', certPath);
            break;
          }
        }
        
        if (!await fs.pathExists(certPath)) {
          return { success: false, message: '证书文件不存在' };
        }
      }
      
      console.log('证书文件存在，正在打开...');
      
      // 根据平台使用不同的打开方式
      if (process.platform === 'darwin') {
        // macOS: 使用open命令
        await execAsync(`open "${certPath}"`);
      } else if (process.platform === 'win32') {
        // Windows: 使用多种方式尝试打开文件
        let opened = false;
        
        try {
          // 方法1: 使用Node.js内置方法（最可靠）
          console.log('尝试使用Node.js内置方法打开文件');
          opened = await openFileWithNode(certPath);
          
          if (!opened) {
            // 方法2: 使用PowerShell
            console.log('尝试使用PowerShell打开文件');
            const powershellCommand = `powershell -Command "Start-Process -FilePath '${certPath}'"`;
            await execAsync(powershellCommand);
            opened = true;
          }
        } catch (psError) {
          console.log('PowerShell命令失败:', psError.message);
          
          try {
            // 方法3: 使用rundll32命令
            console.log('尝试使用rundll32打开文件');
            await execAsync(`rundll32 url.dll,FileProtocolHandler "${certPath}"`);
            opened = true;
          } catch (rundllError) {
            console.log('rundll32命令失败:', rundllError.message);
            
            try {
              // 方法4: 使用explorer命令
              console.log('尝试使用explorer打开文件');
              await execAsync(`explorer "${certPath}"`);
              opened = true;
            } catch (explorerError) {
              console.log('explorer命令失败:', explorerError.message);
              
              try {
                // 方法5: 使用start命令（最后尝试）
                console.log('尝试使用start命令打开文件');
                await execAsync(`start "" "${certPath}"`);
                opened = true;
              } catch (startError) {
                console.log('start命令失败:', startError.message);
              }
            }
          }
        }
        
        if (!opened) {
          throw new Error('所有打开文件的方法都失败了');
        }
      } else {
        // Linux: 使用xdg-open命令
        await execAsync(`xdg-open "${certPath}"`);
      }
      
      return { success: true, message: '已打开证书文件' };
    } catch (error) {
      console.error('打开证书文件失败:', error);
      return { success: false, message: `打开证书文件失败: ${error.message}` };
    }
  });
}

module.exports = {
  setup
}; 