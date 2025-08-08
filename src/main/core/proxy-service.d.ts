import { EventEmitter } from 'events';
export interface ProxyConfig {
    port: number;
    host?: string;
    enableCapture?: boolean;
    enableHttps?: boolean;
    filter?: string;
}
export interface CapturedRequest {
    id: string;
    timestamp: string;
    method: string;
    url: string;
    host: string;
    protocol: string;
    statusCode?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: string;
    responseBody?: string;
    duration?: number;
}
export declare class ProxyService extends EventEmitter {
    private process;
    private capturedData;
    private isRunning;
    private config;
    private whistleDir;
    private lastWhistleId;
    constructor();
    private getWhistleDir;
    start(config: ProxyConfig): Promise<void>;
    stop(): Promise<void>;
    private startWhistle;
    getStatus(): {
        isRunning: boolean;
        config: ProxyConfig | null;
        capturedCount: number;
    };
    getCapturedData(): CapturedRequest[];
    clearCapturedData(): void;
    addCapturedRequest(request: CapturedRequest): void;
    private setSystemProxy;
    private clearSystemProxy;
    private startCaptureListening;
    private startWhistleLogMonitoring;
    private startRealTimeCapture;
    private startApiPolling;
    private fetchWhistleData;
    private getWhistleData;
    private parseWhistleNetworkData;
    private processWhistleSession;
    private parseWhistleApiResponse;
    private parseWhistleOutput;
    private generateRealisticSampleData;
    private getContentType;
    private generateResponseBody;
    private generateSampleData;
    private cleanup;
}
//# sourceMappingURL=proxy-service.d.ts.map