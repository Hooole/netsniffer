const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class CertificateManager {
  constructor() {
    // 在开发环境中使用相对路径，在生产环境中使用resources路径
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      this.certDir = path.join(__dirname, '..', '..', 'certs');
    } else {
      // 在打包后的应用中，证书文件在resources目录中
      this.certDir = path.join(process.resourcesPath, 'certs');
    }
    this.caCertPath = path.join(this.certDir, 'rootCA.crt');
    this.caKeyPath = path.join(this.certDir, 'rootCA.key');
    
    console.log('CertificateManager 初始化:');
    console.log('  - 环境:', process.env.NODE_ENV || 'production');
    console.log('  - 证书目录:', this.certDir);
    console.log('  - 证书路径:', this.caCertPath);
    console.log('  - 私钥路径:', this.caKeyPath);
  }

  async generateCACertificate() {
    console.log('generateCACertificate() 被调用');
    console.log('CA证书路径:', this.caCertPath);
    console.log('CA私钥路径:', this.caKeyPath);
    
    if (await fs.pathExists(this.caCertPath) && await fs.pathExists(this.caKeyPath)) {
      console.log('CA证书已存在，跳过生成');
      return; // 证书已存在
    }

    console.log('开始生成CA证书...');
    
    try {
      // 检查并创建证书目录，添加详细的错误处理
      console.log('证书目录路径:', this.certDir);
      
      // 检查路径是否存在且为目录
      const certDirExists = await fs.pathExists(this.certDir);
      console.log('证书目录存在状态:', certDirExists);
      
      // 如果路径存在但不是目录，删除它
      if (certDirExists) {
        const certDirStat = await fs.stat(this.certDir);
        if (!certDirStat.isDirectory()) {
          console.log('证书路径不是目录，删除:', this.certDir);
          await fs.remove(this.certDir);
        }
      }
      
      // 确保证书目录存在
      console.log('创建证书目录...');
      await fs.ensureDir(this.certDir);
      console.log('证书目录创建完成');
      
      // 优先使用Whistle的证书生成方式
      const whistleCertPath = path.join(__dirname, '..', '..', '.whistle', 'rootCA.crt');
      const whistleKeyPath = path.join(__dirname, '..', '..', '.whistle', 'rootCA.key');
      
      // 如果Whistle已经生成了证书，复制到我们的目录
      if (await fs.pathExists(whistleCertPath) && await fs.pathExists(whistleKeyPath)) {
        await fs.copy(whistleCertPath, this.caCertPath);
        await fs.copy(whistleKeyPath, this.caKeyPath);
        console.log('从Whistle复制证书完成');
        return;
      }
      
      // 尝试启动Whistle来生成证书
      console.log('尝试启动Whistle生成证书...');
      try {
        const { spawn } = require('child_process');
        
        // 在打包后的环境中，使用不同的方式启动Whistle
        let command, args;
        
        if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
          // 开发环境：使用npx
          command = 'npx';
          args = ['whistle', 'start', '--port', '7788'];
          
          console.log('开发环境：使用npx启动Whistle生成证书');
          const whistleProcess = spawn(command, args, {
            stdio: 'pipe',
            cwd: process.cwd()
          });
          
          // 等待一段时间让Whistle生成证书
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 停止Whistle进程
          whistleProcess.kill('SIGTERM');
          
        } else {
          // 生产环境：直接在主进程中启动Whistle
          console.log('生产环境：直接启动Whistle生成证书');
          
          try {
            // 首先检查whistle模块是否可用
            let whistle;
            try {
              whistle = require('whistle');
              console.log('Whistle模块加载成功');
            } catch (moduleError) {
              console.log('Whistle模块加载失败:', moduleError.message);
              throw new Error('Whistle模块不可用，请确保whistle包已正确打包');
            }
            
            const config = {
              port: 7788,
              host: '127.0.0.1'
            };
            
            console.log('Whistle证书生成配置:', config);
            
            // 启动Whistle服务器 - 使用Promise包装异步启动
            await new Promise((resolve, reject) => {
              try {
                console.log('开始调用Whistle证书生成函数...');
                
                // 添加超时处理
                const timeout = setTimeout(() => {
                  console.error('Whistle证书生成超时');
                  reject(new Error('Whistle证书生成超时'));
                }, 15000); // 15秒超时
                
                whistle(config, (err) => {
                  clearTimeout(timeout);
                  console.log('Whistle证书生成回调被调用，错误信息:', err);
                  
                  if (err) {
                    console.error('Whistle证书生成失败，错误详情:', err);
                    console.error('错误类型:', typeof err);
                    console.error('错误消息:', err.message);
                    console.error('错误堆栈:', err.stack);
                    
                    // 确保错误消息不为undefined
                    const errorMessage = err.message || err.toString() || '未知错误';
                    reject(new Error(`Whistle证书生成失败: ${errorMessage}`));
                  } else {
                    console.log('Whistle证书生成启动成功');
                    resolve();
                  }
                });
              } catch (startError) {
                console.error('Whistle证书生成过程中出错:', startError);
                console.error('启动错误类型:', typeof startError);
                console.error('启动错误消息:', startError.message);
                console.error('启动错误堆栈:', startError.stack);
                reject(startError);
              }
            });
            
            // 等待一段时间让Whistle生成证书
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            console.log('Whistle证书生成完成');
            
          } catch (directError) {
            console.log('直接启动Whistle失败:', directError.message);
            
            // 在打包后的环境中，如果直接启动失败，跳过Whistle证书生成
            console.log('跳过Whistle证书生成，使用OpenSSL');
          }
        }
        
        // 检查是否生成了证书
        if (await fs.pathExists(whistleCertPath) && await fs.pathExists(whistleKeyPath)) {
          await fs.copy(whistleCertPath, this.caCertPath);
          await fs.copy(whistleKeyPath, this.caKeyPath);
          console.log('Whistle生成证书完成');
          return;
        }
      } catch (whistleError) {
        console.log('Whistle证书生成失败，使用OpenSSL:', whistleError.message);
      }
      
      // 如果Whistle无法生成证书，使用OpenSSL生成
      console.log('使用OpenSSL生成证书...');
      
      // 生成私钥
      console.log('生成私钥...');
      await execAsync(`openssl genrsa -out "${this.caKeyPath}" 2048`);
      console.log('私钥生成完成');
      
      // 生成证书
      console.log('生成证书配置...');
      const certConfig = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = CN
ST = Beijing
L = Beijing
O = RPA-AI
OU = Development
CN = RPA-AI MITM Proxy CA

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
`;

      const configPath = path.join(this.certDir, 'cert.conf');
      await fs.writeFile(configPath, certConfig);
      
      console.log('生成证书...');
      await execAsync(`openssl req -new -x509 -key "${this.caKeyPath}" -out "${this.caCertPath}" -days 3650 -config "${configPath}"`);
      console.log('证书生成完成');
      
      // 清理配置文件
      await fs.remove(configPath);
      
    } catch (error) {
      console.error('生成CA证书失败:', error);
      throw error;
    }
  }

  async installCertificate() {
    try {
      console.log('开始安装证书...');
      
      // 确保证书存在
      await this.generateCACertificate();
      
      if (process.platform === 'darwin') {
        return await this.installCertificateOnMac();
      } else if (process.platform === 'win32') {
        return await this.installCertificateOnWindows();
      } else {
        return { success: false, message: '不支持的操作系统' };
      }
    } catch (error) {
      console.error('安装证书失败:', error);
      return { success: false, message: `安装证书失败: ${error.message}` };
    }
  }

  async installCertificateOnMac() {
    try {
      console.log('在macOS上安装证书...');
      
      // 获取当前网络服务名称
      const { stdout: services } = await execAsync('networksetup -listallnetworkservices');
      const serviceLines = services.split('\n').filter(line => line.trim() && !line.includes('*'));
      
      if (serviceLines.length === 0) {
        return { success: false, message: '未找到网络服务' };
      }

      const networkService = serviceLines[0];
      console.log(`使用网络服务: ${networkService}`);

      // 安装到用户钥匙串
      await execAsync(`security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain "${this.caCertPath}"`);
      
      console.log('证书已安装到用户钥匙串');
      
      return { 
        success: true, 
        message: '证书安装成功',
        location: '~/Library/Keychains/login.keychain'
      };
    } catch (error) {
      console.error('macOS证书安装失败:', error);
      return { 
        success: false, 
        message: `证书安装失败: ${error.message}`,
        manualSteps: [
          '1. 打开"钥匙串访问"应用',
          '2. 在左侧选择"登录"钥匙串',
          '3. 找到"RPA-AI MITM Proxy CA"证书',
          '4. 双击证书，在"信任"部分设置"使用此证书时"为"始终信任"'
        ]
      };
    }
  }

  async installCertificateOnWindows() {
    try {
      console.log('在Windows上安装证书...');
      console.log('证书路径:', this.caCertPath);
      
      // 检查证书文件是否存在
      const certExists = await fs.pathExists(this.caCertPath);
      console.log('证书文件存在:', certExists);
      
      if (!certExists) {
        console.error('证书文件不存在:', this.caCertPath);
        
        // 尝试查找证书文件
        const possiblePaths = [
          path.join(process.resourcesPath, 'certs', 'rootCA.crt'),
          path.join(__dirname, '..', '..', 'certs', 'rootCA.crt'),
          path.join(process.cwd(), 'certs', 'rootCA.crt'),
        ];
        
        console.log('尝试其他可能的路径:');
        for (const altPath of possiblePaths) {
          const exists = await fs.pathExists(altPath);
          console.log(`  ${altPath}: ${exists ? '✅' : '❌'}`);
          if (exists) {
            console.log('找到证书文件，更新路径');
            this.caCertPath = altPath;
            break;
          }
        }
        
        if (!await fs.pathExists(this.caCertPath)) {
          return { 
            success: false, 
            message: `证书文件不存在: ${this.caCertPath}`,
            manualSteps: [
              '1. 确保证书文件已正确生成',
              '2. 检查证书文件路径',
              '3. 重新生成证书'
            ]
          };
        }
      }
      
      // 获取证书文件的绝对路径
      const absoluteCertPath = path.resolve(this.caCertPath);
      console.log('绝对证书路径:', absoluteCertPath);
      
      // 检查路径中的特殊字符
      const hasSpaces = absoluteCertPath.includes(' ');
      const hasSpecialChars = /[^a-zA-Z0-9\/\\\-_\.]/.test(absoluteCertPath);
      console.log('路径包含空格:', hasSpaces);
      console.log('路径包含特殊字符:', hasSpecialChars);
      
      // 检查文件权限
      try {
        const stat = await fs.stat(this.caCertPath);
        console.log('文件权限:', stat.mode.toString(8));
        console.log('文件大小:', stat.size, '字节');
      } catch (statError) {
        console.error('获取文件信息失败:', statError.message);
      }
      
      // 使用certutil安装证书
      const command = `certutil -addstore -f "ROOT" "${absoluteCertPath}"`;
      console.log('执行命令:', command);
      
      // 尝试执行命令
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && stderr.trim()) {
        console.log('certutil stderr:', stderr);
      }
      
      if (stdout && stdout.trim()) {
        console.log('certutil stdout:', stdout);
      }
      
      console.log('证书已安装到Windows证书存储');
      
      return { 
        success: true, 
        message: '证书安装成功',
        location: 'Windows证书存储'
      };
    } catch (error) {
      console.error('Windows证书安装失败:', error);
      console.error('错误详情:', {
        message: error.message,
        code: error.code,
        signal: error.signal,
        stdout: error.stdout,
        stderr: error.stderr
      });
      
      // 提供更详细的错误信息
      let errorMessage = `证书安装失败: ${error.message}`;
      let manualSteps = [
        '1. 双击证书文件',
        '2. 点击"安装证书"',
        '3. 选择"本地计算机"',
        '4. 选择"将所有证书放入下列存储"',
        '5. 点击"浏览"，选择"受信任的根证书颁发机构"',
        '6. 点击"确定"完成安装'
      ];
      
      // 根据错误类型提供特定建议
      if (error.code === 'ENOENT') {
        errorMessage = 'certutil 命令未找到，请确保以管理员身份运行';
        manualSteps.unshift('以管理员身份运行应用');
      } else if (error.code === 'EACCES') {
        errorMessage = '权限不足，请以管理员身份运行';
        manualSteps.unshift('以管理员身份运行应用');
      } else if (error.stderr && error.stderr.includes('Access is denied')) {
        errorMessage = '访问被拒绝，请以管理员身份运行';
        manualSteps.unshift('以管理员身份运行应用');
      }
      
      return { 
        success: false, 
        message: errorMessage,
        manualSteps
      };
    }
  }

  async checkCertificateInstalled() {
    try {
      if (process.platform === 'darwin') {
        await execAsync(`security find-certificate -c "RPA-AI MITM Proxy CA" -a`);
        return { installed: true, location: 'macOS钥匙串' };
      } else if (process.platform === 'win32') {
        const { stdout } = await execAsync(`certutil -store "ROOT" "RPA-AI MITM Proxy CA"`);
        if (stdout.includes('RPA-AI MITM Proxy CA')) {
          return { installed: true, location: 'Windows证书存储' };
        } else {
          return { installed: false, location: null };
        }
      } else {
        return { installed: false, location: null };
      }
    } catch (error) {
      console.error('检查证书安装状态失败:', error);
      return { installed: false, location: null };
    }
  }

  async getCertificateInfo() {
    try {
      if (!(await fs.pathExists(this.caCertPath))) {
        return {
          exists: false,
          installed: { installed: false, location: null },
          info: null,
          validation: { valid: false },
          guide: { title: '证书未生成', steps: ['请先生成证书'] }
        };
      }

      const installed = await this.checkCertificateInstalled();
      
      // 获取证书信息
      let info = null;
      try {
        if (process.platform === 'darwin') {
          await execAsync(`security find-certificate -c "RPA-AI MITM Proxy CA" -p`);
          info = { subject: 'RPA-AI MITM Proxy CA', issuer: 'RPA-AI MITM Proxy CA' };
        } else {
          info = { subject: 'RPA-AI MITM Proxy CA', issuer: 'RPA-AI MITM Proxy CA' };
        }
      } catch (error) {
        info = { subject: 'RPA-AI MITM Proxy CA', issuer: 'RPA-AI MITM Proxy CA' };
      }

      return {
        exists: true,
        installed,
        info,
        validation: { valid: true },
        guide: { 
          title: '证书安装指导', 
          steps: [
            '1. 确保证书已正确安装',
            '2. 在浏览器中信任证书',
            '3. 重启浏览器以确保生效'
          ]
        }
      };
    } catch (error) {
      console.error('获取证书信息失败:', error);
      return {
        exists: false,
        installed: { installed: false, location: null },
        info: null,
        validation: { valid: false },
        guide: { title: '获取证书信息失败', steps: ['请检查证书文件'] }
      };
    }
  }
}

module.exports = { CertificateManager }; 