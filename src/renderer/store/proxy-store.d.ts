export interface ProxyConfig {
    port: number;
    host?: string;
    enableCapture?: boolean;
    enableHttps?: boolean;
    filter?: string;
}
export interface ProxyStatus {
    isRunning: boolean;
    config: ProxyConfig | null;
    capturedCount: number;
}
interface ProxyStore {
    isRunning: boolean;
    config: ProxyConfig | null;
    capturedCount: number;
    setRunning: (running: boolean) => void;
    setConfig: (config: ProxyConfig | null) => void;
    setCapturedCount: (count: number) => void;
    setStatus: (status: ProxyStatus) => void;
    reset: () => void;
}
export declare const useProxyStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<ProxyStore>, "setState"> & {
    setState<A extends string | {
        type: string;
    }>(partial: ProxyStore | Partial<ProxyStore> | ((state: ProxyStore) => ProxyStore | Partial<ProxyStore>), replace?: boolean | undefined, action?: A | undefined): void;
}>;
export {};
//# sourceMappingURL=proxy-store.d.ts.map