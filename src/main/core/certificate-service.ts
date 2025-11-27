import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from 'electron-log';
import { shell, app } from 'electron';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sudoPrompt = require('sudo-prompt');

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

    // 尝试发现实际的 whistle 证书路径
    this.discoverExistingCertificate();
  }

  private async discoverExistingCertificate(): Promise<void> {
    try {
      // 检查当前路径是否有效
      if (await fs.pathExists(this.caCertPath)) {
        logger.info(`Certificate found at current path: ${this.caCertPath}`);
        return;
      }

      // 搜索常见的 whistle 证书位置
      const searchPaths = this.getWhistleCertSearchPaths();

      for (const searchPath of searchPaths) {
        try {
          if (await fs.pathExists(searchPath)) {
            logger.info(`Found existing certificate at: ${searchPath}`);
            this.caCertPath = searchPath;
            this.caKeyPath = path.join(path.dirname(searchPath), 'rootCA.key');
            this.certDir = path.dirname(searchPath);
            return;
          }
        } catch {}
      }

      logger.info(`No existing certificate found, will use: ${this.caCertPath}`);
    } catch (error) {
      logger.warn('Failed to discover existing certificate:', error);
    }
  }

  private getWhistleCertSearchPaths(): string[] {
    const os = require('os');
    const platform = process.platform;
    const homeDir = os.homedir();
    const paths: string[] = [];

    if (platform === 'win32') {
      // Windows 特定路径
      paths.push(
        // AppData 路径
        path.join(
          os.homedir(),
          'AppData',
          'Roaming',
          '.WhistleAppData',
          '.whistle',
          'certs',
          'root.crt'
        ),
        path.join(
          os.homedir(),
          'AppData',
          'Roaming',
          '.WhistleAppData',
          '.whistle',
          'certs',
          'rootCA.crt'
        ),
        path.join(
          os.homedir(),
          'AppData',
          'Local',
          '.WhistleAppData',
          '.whistle',
          'certs',
          'root.crt'
        ),
        path.join(
          os.homedir(),
          'AppData',
          'Local',
          '.WhistleAppData',
          '.whistle',
          'certs',
          'rootCA.crt'
        ),

        // 用户目录
        path.join(homeDir, '.WhistleAppData', '.whistle', 'certs', 'root.crt'),
        path.join(homeDir, '.WhistleAppData', '.whistle', 'certs', 'rootCA.crt'),
        path.join(homeDir, '.whistle', 'certs', 'root.crt'),
        path.join(homeDir, '.whistle', 'certs', 'rootCA.crt')
      );
    } else {
      // macOS/Linux 路径
      paths.push(
        // 标准 whistle 位置
        path.join(homeDir, '.WhistleAppData', '.whistle', 'certs', 'root.crt'),
        path.join(homeDir, '.WhistleAppData', '.whistle', 'certs', 'rootCA.crt'),

        // 全局 whistle 路径
        path.join(homeDir, '.whistle', 'certs', 'root.crt'),
        path.join(homeDir, '.whistle', 'certs', 'rootCA.crt')
      );
    }

    // 通用路径 - 所有平台
    paths.push(
      // 用户数据目录
      path.join(app.getPath('userData'), '.whistle', 'certs', 'root.crt'),
      path.join(app.getPath('userData'), '.whistle', 'certs', 'rootCA.crt'),

      // 开发环境路径
      path.join(__dirname, '../../../.whistle', 'certs', 'root.crt'),
      path.join(__dirname, '../../../.whistle', 'certs', 'rootCA.crt')
    );

    logger.info(`Platform: ${platform}, searching ${paths.length} certificate paths`);
    return paths;
  }

  private getCertDir(): string {
    // 与 ProxyService 的 whistle 存储目录保持一致
    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
    if (isDev) {
      // 与 ProxyService 的 dev 路径对应：__dirname/../../../.whistle
      return path.join(__dirname, '../../../.whistle', 'certs');
    }
    try {
      const userData = app.getPath('userData');
      return path.join(userData, '.whistle', 'certs');
    } catch {
      return path.join(process.resourcesPath, '.whistle', 'certs');
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

    // 添加调试信息
    if (!installed) {
      await this.debugInstallationStatus();
    }

    return {
      installed,
      path: this.caCertPath,
      exists: true,
    };
  }

  async generate(): Promise<void> {
    try {
      await fs.ensureDir(this.certDir);

      const ensureCAExists = async () => {
        let exists = await fs.pathExists(this.caCertPath);
        let discoveredCA: string | undefined;
        if (exists) return { caPath: this.caCertPath } as { caPath: string };
        const storageRoot = path.dirname(this.certDir);
        const childScript = path.join(__dirname, 'whistle-child.js');
        const preferEntry = (() => {
          try {
            return require.resolve('whistle');
          } catch {
            return '';
          }
        })();
        const opts = encodeURIComponent(
          JSON.stringify({
            port: 0,
            host: '127.0.0.1',
            storage: storageRoot,
            mode: 'capture',
            whistleEntry: preferEntry,
          })
        );
        const { fork } = require('child_process') as typeof import('child_process');
        const child = fork(childScript, [opts], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (!done) {
              done = true;
              try {
                child.kill();
              } catch {}
              resolve();
            }
          };
          child.on('message', (msg: any) => {
            if (msg && msg.type === 'ready') {
              const rc = msg && msg.options && msg.options.rootCAFile;
              if (rc && typeof rc === 'string') {
                discoveredCA = rc;
              }
              finish();
            }
          });
          child.on('exit', () => finish());
          setTimeout(() => finish(), 8000);
        });
        // 若 whistle 报告了 CA 路径，则以其为准
        if (discoveredCA) {
          exists = await fs.pathExists(discoveredCA);
          if (exists) return { caPath: discoveredCA } as { caPath: string };
        }
        // 兜底：返回当前设定路径
        return { caPath: this.caCertPath } as { caPath: string };
      };

      const ensured = await ensureCAExists();
      const caPath = ensured?.caPath || this.caCertPath;
      // 同步内部路径至 whistle 实际 CA 位置
      if (caPath && caPath !== this.caCertPath) {
        logger.info(`Updating certificate path from ${this.caCertPath} to ${caPath}`);
        this.caCertPath = caPath;
        this.caKeyPath = path.join(path.dirname(caPath), 'rootCA.key');
      } else {
        logger.info(`Certificate path remains: ${this.caCertPath}`);
      }
      // 仅使用 whistle 的 ca 安装器来生成（与 whistle-client 保持一致）
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const installRootCAFile = require('whistle/bin/ca');
      const execWithSudo = (cmd: string) =>
        new Promise<void>((resolve, reject) => {
          try {
            sudoPrompt.exec(cmd, { name: 'AiResident' }, (err: any) => {
              if (err) return reject(err);
              resolve();
            });
          } catch (e) {
            reject(e);
          }
        });
      await installRootCAFile(this.caCertPath, (cmd: string) => execWithSudo(cmd));
      logger.info('Certificate generated via whistle');
    } catch (error) {
      logger.error('Failed to generate certificate via whistle:', error);
      throw error;
    }
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

    // 优先尝试复用 whistle 提供的跨平台安装器
    const installedByWhistle = await this.tryInstallViaWhistle();
    if (installedByWhistle) return;

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

  private async tryInstallViaWhistle(): Promise<boolean> {
    try {
      // 动态引入，避免打包静态分析问题
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const installRootCAFile = require('whistle/bin/ca');
      const execWithSudo = (cmd: string) =>
        new Promise<void>((resolve, reject) => {
          try {
            sudoPrompt.exec(cmd, { name: 'AiResident' }, (err: any) => {
              if (err) return reject(err);
              resolve();
            });
          } catch (e) {
            reject(e);
          }
        });
      // 让 whistle 负责证书生成与安装（其内部已处理各平台差异），必要时会调用回调提权
      await installRootCAFile(this.caCertPath, (cmd: string) => execWithSudo(cmd));
      return true;
    } catch (e) {
      // 未找到模块或执行失败则回退
      return false;
    }
  }

  private async installOnMacOS(): Promise<void> {
    // 优先尝试以管理员权限写入 System keychain（会触发系统提权弹窗）
    try {
      const osaCmd = `/usr/bin/osascript -e 'do shell script "security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain " & quoted form of POSIX path "${this.caCertPath}" & "" with administrator privileges'`;
      await execAsync(osaCmd);
      return;
    } catch (e) {
      logger.warn('Install to System keychain failed, fallback to login keychain:', e);
    }
    // 回退：安装到当前用户的 login keychain（无需 sudo）
    const loginKeychain = path.join(process.env.HOME || '', 'Library/Keychains/login.keychain-db');
    await execAsync(
      `security add-trusted-cert -d -r trustRoot -k "${loginKeychain}" "${this.caCertPath}"`
    );
  }

  private async installOnWindows(): Promise<void> {
    // 优先安装到本地计算机根证书（需要管理员），失败则回退到当前用户根证书
    try {
      await execAsync(`certutil -addstore -f "ROOT" "${this.caCertPath}"`);
      return;
    } catch (e) {
      // 回退到当前用户根证书
      const ps =
        'powershell -NoProfile -ExecutionPolicy Bypass -Command ' +
        `"Import-Certificate -FilePath "${this.caCertPath.replace(/\\/g, '/')}" -CertStoreLocation Cert:\\CurrentUser\\Root | Out-Null"`;
      await execAsync(ps);
    }
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
    // 先尝试从 System keychain 删除（需要管理员权限）
    try {
      const osaCmd = `/usr/bin/osascript -e 'do shell script "security delete-certificate -c \\"AiResident Root CA\\" /Library/Keychains/System.keychain" with administrator privileges'`;
      await execAsync(osaCmd);
    } catch (e) {
      logger.warn('Remove from System keychain failed, try login keychain:', e);
    }
    // 再尝试从 login keychain 删除
    const loginKeychain = path.join(process.env.HOME || '', 'Library/Keychains/login.keychain-db');
    try {
      await execAsync(`security delete-certificate -c "AiResident Root CA" "${loginKeychain}"`);
    } catch {}
  }

  private async uninstallOnWindows(): Promise<void> {
    await execAsync(`certutil -delstore "ROOT" "AiResident Root CA"`);
  }

  private async uninstallOnLinux(): Promise<void> {
    const targetPath = '/usr/local/share/ca-certificates/netsniffer-ca.crt';
    await execAsync(`sudo rm -f "${targetPath}"`);
    await execAsync('sudo update-ca-certificates');
  }

  async openFile(): Promise<void> {
    if (await fs.pathExists(this.caCertPath)) {
      try {
        // 优先在文件夹中展示，避免系统直接触发导入证书向导
        shell.showItemInFolder(this.caCertPath);
      } catch {
        // 回退：仍可打开路径（可能触发导入向导）
        await shell.openPath(this.caCertPath);
      }
    } else {
      throw new Error('Certificate file does not exist');
    }
  }

  // 读取证书指纹（SHA-1），用于比对钥匙串中的证书
  private async getCertFingerprint(certPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(
        `/usr/bin/openssl x509 -noout -fingerprint -sha1 -in "${certPath}"`
      );
      const m = /SHA1 Fingerprint=([A-F0-9:]+)/i.exec(stdout || '');
      return m ? m[1].toUpperCase() : null;
    } catch {
      return null;
    }
  }

  private async keychainHasFingerprint(keychain: string, fingerprint: string): Promise<boolean> {
    try {
      // 列出该钥匙串所有证书的 SHA-1 指纹（不限定 CN），读取其指纹进行对比
      const { stdout } = await execAsync(`/usr/bin/security find-certificate -a -Z "${keychain}"`);
      // 输出中包含 SHA-1 哈希，无分隔，需去掉冒号比较
      const compact = (s: string) => s.replace(/[^A-F0-9]/gi, '').toUpperCase();
      const fp = compact(fingerprint);
      const has = stdout && compact(stdout).includes(fp);
      return !!has;
    } catch {
      return false;
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
      // 方法1: 基于指纹检测
      const fingerprintResult = await this.checkByFingerprint();
      if (fingerprintResult) return true;

      // 方法2: 基于主题名称检测（备用方案）
      const subjectResult = await this.checkBySubject();
      if (subjectResult) return true;

      // 方法3: 检测常见的钥匙串位置
      const alternativeResult = await this.checkAlternativeKeychains();
      return alternativeResult;
    } catch (e) {
      logger.warn('checkMacOSInstallation error:', e);
      return false;
    }
  }

  private async checkByFingerprint(): Promise<boolean> {
    try {
      const fp = await this.getCertFingerprint(this.caCertPath);
      if (!fp) return false;

      const systemHas = await this.keychainHasFingerprint('/Library/Keychains/System.keychain', fp);
      if (systemHas) return true;

      const loginKeychain = path.join(
        process.env.HOME || '',
        'Library/Keychains/login.keychain-db'
      );
      const loginHas = await this.keychainHasFingerprint(loginKeychain, fp);
      return loginHas;
    } catch (e) {
      logger.warn('checkByFingerprint failed:', e);
      return false;
    }
  }

  private async checkBySubject(): Promise<boolean> {
    try {
      // 获取证书主题
      const { stdout } = await execAsync(
        `/usr/bin/openssl x509 -noout -subject -in "${this.caCertPath}"`
      );
      const subjectMatch = /subject=(.+)$/m.exec(stdout);
      if (!subjectMatch) return false;

      const subject = subjectMatch[1].trim();
      logger.info(`Looking for certificate with subject: ${subject}`);

      // 提取 CN (Common Name) 用于搜索
      const cnMatch = /CN\s*=\s*([^,]+)/i.exec(subject);
      const searchTerms = ['AiResident'];

      if (cnMatch) {
        const cn = cnMatch[1].trim().replace(/['"]/g, '');
        searchTerms.push(cn);
        logger.info(`Certificate CN: ${cn}`);
      }

      // 添加常见的 whistle 证书名称
      searchTerms.push('whistle', 'whistle.local', 'whistle CA');

      // 在系统钥匙串中搜索多个可能的名称
      for (const term of searchTerms) {
        try {
          const { stdout: systemResult } = await execAsync(
            `/usr/bin/security find-certificate -a -c "${term}" /Library/Keychains/System.keychain`
          );
          if (systemResult.trim()) {
            logger.info(`Certificate found in system keychain with name: ${term}`);
            return true;
          }
        } catch {}
      }

      // 在登录钥匙串中搜索
      const loginKeychain = path.join(
        process.env.HOME || '',
        'Library/Keychains/login.keychain-db'
      );
      for (const term of searchTerms) {
        try {
          const { stdout: loginResult } = await execAsync(
            `/usr/bin/security find-certificate -a -c "${term}" "${loginKeychain}"`
          );
          if (loginResult.trim()) {
            logger.info(`Certificate found in login keychain with name: ${term}`);
            return true;
          }
        } catch {}
      }

      return false;
    } catch (e) {
      logger.warn('checkBySubject failed:', e);
      return false;
    }
  }

  private async checkAlternativeKeychains(): Promise<boolean> {
    try {
      // 检查其他可能的钥匙串位置
      const keychainPaths = [
        path.join(process.env.HOME || '', 'Library/Keychains/login.keychain'),
        '/System/Library/Keychains/SystemRootCertificates.keychain',
        '/Library/Keychains/System.keychain',
      ];

      // 获取证书实际的 CN 名称
      const searchTerms = ['AiResident', 'whistle', 'whistle.local', 'whistle CA'];
      try {
        const { stdout } = await execAsync(
          `/usr/bin/openssl x509 -noout -subject -in "${this.caCertPath}"`
        );
        const cnMatch = /CN\s*=\s*([^,]+)/i.exec(stdout);
        if (cnMatch) {
          const cn = cnMatch[1].trim().replace(/['"]/g, '');
          searchTerms.push(cn);
        }
      } catch {}

      for (const keychainPath of keychainPaths) {
        for (const term of searchTerms) {
          try {
            const { stdout } = await execAsync(
              `/usr/bin/security find-certificate -a -c "${term}" "${keychainPath}"`
            );
            if (stdout.trim()) {
              logger.info(
                `Certificate found in alternative keychain: ${keychainPath} with name: ${term}`
              );
              return true;
            }
          } catch {}
        }
      }

      return false;
    } catch (e) {
      logger.warn('checkAlternativeKeychains failed:', e);
      return false;
    }
  }

  private async checkWindowsInstallation(): Promise<boolean> {
    try {
      // 方法1: 通过证书名称搜索（本地计算机存储）
      const systemResult = await this.checkWindowsSystemStore();
      if (systemResult) return true;

      // 方法2: 通过证书名称搜索（当前用户存储）
      const userResult = await this.checkWindowsUserStore();
      if (userResult) return true;

      // 方法3: 通过证书指纹搜索（兼容性检测）
      const fingerprintResult = await this.checkWindowsByFingerprint();
      return fingerprintResult;
    } catch (e) {
      logger.warn('checkWindowsInstallation error:', e);
      return false;
    }
  }

  private async checkWindowsSystemStore(): Promise<boolean> {
    try {
      // 获取证书的实际主题名称
      const searchTerms = await this.getWindowsCertSearchTerms();

      // 检查本地计算机的根证书存储
      for (const term of searchTerms) {
        try {
          const result = await execAsync(`certutil -store "ROOT" | findstr "${term}"`);
          if (result.stdout.includes(term)) {
            logger.info(`Certificate found in Windows system ROOT store with name: ${term}`);
            return true;
          }
        } catch {}
      }

      // 也检查其他可能的存储位置
      for (const term of searchTerms) {
        try {
          const caResult = await execAsync(`certutil -store "CA" | findstr "${term}"`);
          if (caResult.stdout.includes(term)) {
            logger.info(`Certificate found in Windows system CA store with name: ${term}`);
            return true;
          }
        } catch {}
      }
    } catch (e) {
      logger.warn('Failed to check Windows system store:', e);
    }
    return false;
  }

  private async checkWindowsUserStore(): Promise<boolean> {
    try {
      // 获取证书的实际主题名称
      const searchTerms = await this.getWindowsCertSearchTerms();

      // 检查当前用户的根证书存储
      for (const term of searchTerms) {
        try {
          const result = await execAsync(`certutil -user -store "ROOT" | findstr "${term}"`);
          if (result.stdout.includes(term)) {
            logger.info(`Certificate found in Windows user ROOT store with name: ${term}`);
            return true;
          }
        } catch {}
      }

      // 也检查用户的CA存储
      for (const term of searchTerms) {
        try {
          const caResult = await execAsync(`certutil -user -store "CA" | findstr "${term}"`);
          if (caResult.stdout.includes(term)) {
            logger.info(`Certificate found in Windows user CA store with name: ${term}`);
            return true;
          }
        } catch {}
      }
    } catch (e) {
      logger.warn('Failed to check Windows user store:', e);
    }
    return false;
  }

  private async getWindowsCertSearchTerms(): Promise<string[]> {
    const searchTerms = ['AiResident', 'whistle', 'whistle.local', 'whistle CA'];

    try {
      // 使用 PowerShell 获取证书主题信息
      const psScript = `
        $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${this.caCertPath.replace(/\\/g, '\\\\')}')
        Write-Output "Subject: $($cert.Subject)"
        Write-Output "Issuer: $($cert.Issuer)"
      `;

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`);

      // 提取 CN 从 Subject 和 Issuer
      const cnMatches = stdout.match(/CN\s*=\s*([^,\r\n]+)/g);
      if (cnMatches) {
        cnMatches.forEach((match) => {
          const cn = match
            .replace(/CN\s*=\s*/, '')
            .trim()
            .replace(/['"]/g, '');
          if (cn && !searchTerms.includes(cn)) {
            searchTerms.push(cn);
          }
        });
      }
    } catch (e) {
      logger.warn('Failed to extract certificate CN for Windows search:', e);
    }

    logger.info(`Windows certificate search terms: ${searchTerms.join(', ')}`);
    return searchTerms;
  }

  private async checkWindowsByFingerprint(): Promise<boolean> {
    try {
      if (!(await fs.pathExists(this.caCertPath))) return false;

      // 使用 PowerShell 获取证书指纹
      const psScript = `
        $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${this.caCertPath.replace(/\\/g, '\\\\')}')
        $cert.Thumbprint
      `;

      const { stdout: thumbprint } = await execAsync(
        `powershell -NoProfile -Command "${psScript}"`
      );
      const fp = thumbprint.trim().toUpperCase();

      if (!fp) return false;

      // 在系统存储中搜索指纹
      try {
        const { stdout: systemCerts } = await execAsync('certutil -store "ROOT"');
        if (systemCerts.toUpperCase().includes(fp)) {
          logger.info(`Certificate found by fingerprint in system store: ${fp}`);
          return true;
        }
      } catch {}

      // 在用户存储中搜索指纹
      try {
        const { stdout: userCerts } = await execAsync('certutil -user -store "ROOT"');
        if (userCerts.toUpperCase().includes(fp)) {
          logger.info(`Certificate found by fingerprint in user store: ${fp}`);
          return true;
        }
      } catch {}

      return false;
    } catch (e) {
      logger.warn('checkWindowsByFingerprint failed:', e);
      return false;
    }
  }

  private async checkLinuxInstallation(): Promise<boolean> {
    const targetPath = '/usr/local/share/ca-certificates/netsniffer-ca.crt';
    return await fs.pathExists(targetPath);
  }

  private async debugInstallationStatus(): Promise<void> {
    try {
      logger.info('=== Certificate Installation Debug ===');
      logger.info(`Certificate path: ${this.caCertPath}`);
      logger.info(`Platform: ${process.platform}`);

      if (process.platform === 'darwin') {
        await this.debugMacOSInstallation();
      } else if (process.platform === 'win32') {
        await this.debugWindowsInstallation();
      } else if (process.platform === 'linux') {
        await this.debugLinuxInstallation();
      }

      logger.info('=== End Debug ===');
    } catch (error) {
      logger.error('Debug installation status failed:', error);
    }
  }

  private async debugMacOSInstallation(): Promise<void> {
    // 获取证书指纹
    const fingerprint = await this.getCertFingerprint(this.caCertPath);
    logger.info(`Certificate fingerprint: ${fingerprint}`);

    // 检查系统钥匙串
    const systemKeychain = '/Library/Keychains/System.keychain';
    const systemHas = fingerprint
      ? await this.keychainHasFingerprint(systemKeychain, fingerprint)
      : false;
    logger.info(`System keychain (${systemKeychain}) has cert: ${systemHas}`);

    // 检查登录钥匙串
    const loginKeychain = path.join(process.env.HOME || '', 'Library/Keychains/login.keychain-db');
    const loginHas = fingerprint
      ? await this.keychainHasFingerprint(loginKeychain, fingerprint)
      : false;
    logger.info(`Login keychain (${loginKeychain}) has cert: ${loginHas}`);

    // 列出所有钥匙串中的证书（用于调试）
    try {
      const { stdout: systemCerts } = await execAsync(
        `/usr/bin/security find-certificate -a -p "${systemKeychain}" | /usr/bin/openssl x509 -noout -subject -issuer 2>/dev/null || echo "No certs or access denied"`
      );
      logger.info(
        `System keychain certificates: ${systemCerts.split('\n').slice(0, 5).join('\\n')}`
      );
    } catch (e) {
      logger.info(`Failed to list system certificates: ${e}`);
    }

    try {
      const { stdout: loginCerts } = await execAsync(
        `/usr/bin/security find-certificate -a -p "${loginKeychain}" | /usr/bin/openssl x509 -noout -subject -issuer 2>/dev/null || echo "No certs or access denied"`
      );
      logger.info(`Login keychain certificates: ${loginCerts.split('\n').slice(0, 5).join('\\n')}`);
    } catch (e) {
      logger.info(`Failed to list login certificates: ${e}`);
    }
  }

  private async debugWindowsInstallation(): Promise<void> {
    try {
      // 检查系统存储
      logger.info('Checking Windows system certificate stores...');

      try {
        const { stdout: systemRoot } = await execAsync(
          'certutil -store "ROOT" | findstr /C:"AiResident"'
        );
        logger.info(`System ROOT store: ${systemRoot ? 'Found certificates' : 'No certificates'}`);
      } catch (e) {
        logger.info(`System ROOT store check failed: ${e}`);
      }

      try {
        const { stdout: userRoot } = await execAsync(
          'certutil -user -store "ROOT" | findstr /C:"AiResident"'
        );
        logger.info(`User ROOT store: ${userRoot ? 'Found certificates' : 'No certificates'}`);
      } catch (e) {
        logger.info(`User ROOT store check failed: ${e}`);
      }

      // 获取证书指纹
      if (await fs.pathExists(this.caCertPath)) {
        try {
          const psScript = `
            $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${this.caCertPath.replace(/\\/g, '\\\\')}')
            Write-Output "Subject: $($cert.Subject)"
            Write-Output "Thumbprint: $($cert.Thumbprint)"
            Write-Output "Issuer: $($cert.Issuer)"
          `;
          const { stdout: certInfo } = await execAsync(
            `powershell -NoProfile -Command "${psScript}"`
          );
          logger.info(`Certificate info: ${certInfo}`);
        } catch (e) {
          logger.info(`Failed to get certificate info: ${e}`);
        }
      }

      // 检查搜索词
      try {
        const searchTerms = await this.getWindowsCertSearchTerms();
        logger.info(`Windows search terms: ${searchTerms.join(', ')}`);
      } catch (e) {
        logger.info(`Failed to get search terms: ${e}`);
      }
    } catch (error) {
      logger.error('Windows debug failed:', error);
    }
  }

  private async debugLinuxInstallation(): Promise<void> {
    const targetPath = '/usr/local/share/ca-certificates/netsniffer-ca.crt';
    const exists = await fs.pathExists(targetPath);
    logger.info(`Linux certificate path (${targetPath}) exists: ${exists}`);

    if (await fs.pathExists(this.caCertPath)) {
      try {
        const { stdout: certInfo } = await execAsync(
          `openssl x509 -in "${this.caCertPath}" -noout -subject -issuer`
        );
        logger.info(`Certificate info: ${certInfo}`);
      } catch (e) {
        logger.info(`Failed to get certificate info: ${e}`);
      }
    }
  }
}
