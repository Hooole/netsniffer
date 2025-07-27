const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class CertificateManager {
  constructor() {
    this.certDir = path.join(__dirname, '..', '..', 'certs');
    this.caCertPath = path.join(this.certDir, 'rootCA.crt');
    this.caKeyPath = path.join(this.certDir, 'rootCA.key');
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
      // 确保证书目录存在
      await fs.ensureDir(this.certDir);
      
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
        const whistleProcess = spawn('npx', ['whistle', 'start', '--port', '7788'], {
          stdio: 'pipe',
          cwd: process.cwd()
        });
        
        // 等待一段时间让Whistle生成证书
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 停止Whistle进程
        whistleProcess.kill('SIGTERM');
        
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
      
      // 使用certutil安装证书
      await execAsync(`certutil -addstore -f "ROOT" "${this.caCertPath}"`);
      
      console.log('证书已安装到Windows证书存储');
      
      return { 
        success: true, 
        message: '证书安装成功',
        location: 'Windows证书存储'
      };
    } catch (error) {
      console.error('Windows证书安装失败:', error);
      return { 
        success: false, 
        message: `证书安装失败: ${error.message}`,
        manualSteps: [
          '1. 双击证书文件',
          '2. 点击"安装证书"',
          '3. 选择"本地计算机"',
          '4. 选择"将所有证书放入下列存储"',
          '5. 点击"浏览"，选择"受信任的根证书颁发机构"',
          '6. 点击"确定"完成安装'
        ]
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