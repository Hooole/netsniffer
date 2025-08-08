export interface CertificateStatus {
    installed: boolean;
    path: string;
    exists: boolean;
    validFor?: string[];
    expiryDate?: string;
}
export declare class CertificateService {
    private certDir;
    private caCertPath;
    private caKeyPath;
    constructor();
    private getCertDir;
    getStatus(): Promise<CertificateStatus>;
    generate(): Promise<void>;
    private generateCertificate;
    install(): Promise<void>;
    private installCertificate;
    private installOnMacOS;
    private installOnWindows;
    private installOnLinux;
    uninstall(): Promise<void>;
    private uninstallOnMacOS;
    private uninstallOnWindows;
    private uninstallOnLinux;
    openFile(): Promise<void>;
    private checkInstallation;
    private checkMacOSInstallation;
    private checkWindowsInstallation;
    private checkLinuxInstallation;
}
//# sourceMappingURL=certificate-service.d.ts.map