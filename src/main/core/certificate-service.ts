import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from 'electron-log';
import { shell } from 'electron';

const execAsync = promisify(exec);

export interface CertificateStatus {
  installed: boolean;
  path: string;
  exists: boolean;
  validFor?: string[];
  expiryDate?: string;
}

export class CertificateService {
  private certDir: string;
  private caCertPath: string;
  private caKeyPath: string;

  constructor() {
    this.certDir = this.getCertDir();
    this.caCertPath = path.join(this.certDir, 'rootCA.crt');
    this.caKeyPath = path.join(this.certDir, 'rootCA.key');
  }

  private getCertDir(): string {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      return path.join(__dirname, '../../../certs');
    } else {
      return path.join(process.resourcesPath, 'certs');
    }
  }

  async getStatus(): Promise<CertificateStatus> {
    const exists = await fs.pathExists(this.caCertPath);
    
    if (!exists) {
      return {
        installed: false,
        path: this.caCertPath,
        exists: false,
      };
    }

    const installed = await this.checkInstallation();
    
    return {
      installed,
      path: this.caCertPath,
      exists: true,
    };
  }

  async generate(): Promise<void> {
    try {
      await fs.ensureDir(this.certDir);
      
      // 首先尝试从Whistle获取证书
      const whistleCertPath = path.join(this.certDir, '../.whistle/certs/rootCA.crt');
      const whistleKeyPath = path.join(this.certDir, '../.whistle/certs/rootCA.key');
      
      if (await fs.pathExists(whistleCertPath) && await fs.pathExists(whistleKeyPath)) {
        await fs.copy(whistleCertPath, this.caCertPath);
        await fs.copy(whistleKeyPath, this.caKeyPath);
        logger.info('Certificate copied from Whistle');
        return;
      }

      // 如果Whistle证书不存在，生成新证书
      await this.generateCertificate();
      logger.info('New certificate generated');
    } catch (error) {
      logger.error('Failed to generate certificate:', error);
      throw error;
    }
  }

  private async generateCertificate(): Promise<void> {
    // 生成私钥
    await execAsync(`openssl genrsa -out "${this.caKeyPath}" 2048`);
    
    // 生成证书
    const subject = '/C=CN/ST=Beijing/L=Beijing/O=NetSniffer/CN=NetSniffer Root CA';
    await execAsync(
      `openssl req -new -x509 -days 365 -key "${this.caKeyPath}" -out "${this.caCertPath}" -subj "${subject}"`
    );
  }

  async install(): Promise<void> {
    try {
      // 确保证书存在
      if (!(await fs.pathExists(this.caCertPath))) {
        await this.generate();
      }

      await this.installCertificate();
      logger.info('Certificate installed successfully');
    } catch (error) {
      logger.error('Failed to install certificate:', error);
      throw error;
    }
  }

  private async installCertificate(): Promise<void> {
    const platform = process.platform;

    switch (platform) {
      case 'darwin':
        await this.installOnMacOS();
        break;
      case 'win32':
        await this.installOnWindows();
        break;
      case 'linux':
        await this.installOnLinux();
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async installOnMacOS(): Promise<void> {
    // 使用security命令安装证书到系统钥匙串
    await execAsync(`security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${this.caCertPath}"`);
  }

  private async installOnWindows(): Promise<void> {
    // 使用certlm.msc安装证书到受信任的根证书颁发机构
    await execAsync(`certutil -addstore -f "ROOT" "${this.caCertPath}"`);
  }

  private async installOnLinux(): Promise<void> {
    // 复制证书到系统目录并更新证书库
    const systemCertDir = '/usr/local/share/ca-certificates';
    const targetPath = path.join(systemCertDir, 'netsniffer-ca.crt');
    
    await execAsync(`sudo cp "${this.caCertPath}" "${targetPath}"`);
    await execAsync('sudo update-ca-certificates');
  }

  async uninstall(): Promise<void> {
    try {
      const platform = process.platform;

      switch (platform) {
        case 'darwin':
          await this.uninstallOnMacOS();
          break;
        case 'win32':
          await this.uninstallOnWindows();
          break;
        case 'linux':
          await this.uninstallOnLinux();
          break;
      }

      logger.info('Certificate uninstalled successfully');
    } catch (error) {
      logger.error('Failed to uninstall certificate:', error);
      throw error;
    }
  }

  private async uninstallOnMacOS(): Promise<void> {
    await execAsync(`security delete-certificate -c "NetSniffer Root CA" /Library/Keychains/System.keychain`);
  }

  private async uninstallOnWindows(): Promise<void> {
    await execAsync(`certutil -delstore "ROOT" "NetSniffer Root CA"`);
  }

  private async uninstallOnLinux(): Promise<void> {
    const targetPath = '/usr/local/share/ca-certificates/netsniffer-ca.crt';
    await execAsync(`sudo rm -f "${targetPath}"`);
    await execAsync('sudo update-ca-certificates');
  }

  async openFile(): Promise<void> {
    if (await fs.pathExists(this.caCertPath)) {
      await shell.openPath(this.caCertPath);
    } else {
      throw new Error('Certificate file does not exist');
    }
  }

  private async checkInstallation(): Promise<boolean> {
    try {
      const platform = process.platform;

      switch (platform) {
        case 'darwin':
          return await this.checkMacOSInstallation();
        case 'win32':
          return await this.checkWindowsInstallation();
        case 'linux':
          return await this.checkLinuxInstallation();
        default:
          return false;
      }
    } catch (error) {
      logger.warn('Failed to check certificate installation:', error);
      return false;
    }
  }

  private async checkMacOSInstallation(): Promise<boolean> {
    try {
      await execAsync('security find-certificate -c "NetSniffer Root CA" /Library/Keychains/System.keychain');
      return true;
    } catch {
      return false;
    }
  }

  private async checkWindowsInstallation(): Promise<boolean> {
    try {
      const result = await execAsync('certutil -store "ROOT" | findstr "NetSniffer"');
      return result.stdout.includes('NetSniffer');
    } catch {
      return false;
    }
  }

  private async checkLinuxInstallation(): Promise<boolean> {
    const targetPath = '/usr/local/share/ca-certificates/netsniffer-ca.crt';
    return await fs.pathExists(targetPath);
  }
}