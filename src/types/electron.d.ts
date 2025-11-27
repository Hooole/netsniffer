declare global {
  interface Window {
    electronAPI?: {
      // 代理相关API
      proxy: {
        start: (config: any) => Promise<{ success: boolean; message?: string; data?: any }>;
        stop: () => Promise<{ success: boolean; message?: string }>;
        getStatus: () => Promise<{ success: boolean; data?: any; message?: string }>;
        setSystemProxy: (config: any) => Promise<{ success: boolean; message?: string }>;
        clearSystemProxy: () => Promise<{ success: boolean; message?: string }>;
        getSystemProxyStatus: () => Promise<{
          success: boolean;
          enabled?: boolean;
          details?: any;
          message?: string;
        }>;
      };

      // 抓包相关API
      capture: {
        getCapturedData: () => Promise<{ success: boolean; data?: any[]; message?: string }>;
        fetchWhistleSnapshot: () => Promise<{ success: boolean; data?: any[]; message?: string }>;
        getWhistleRaw: (
          options?: any
        ) => Promise<{ success: boolean; data?: any; message?: string }>;
        resetWhistleCursor: () => Promise<{ success: boolean; message?: string }>;
        clearCapturedData: () => Promise<{ success: boolean; message?: string }>;
        exportData: (format: string) => Promise<{ success: boolean; message?: string }>;
        onDataUpdate: (callback: (data: any[]) => void) => () => void;
      };

      // 证书相关API
      certificate: {
        getStatus: () => Promise<{ success: boolean; data?: any; message?: string }>;
        install: () => Promise<{ success: boolean; message?: string }>;
        uninstall: () => Promise<{ success: boolean; message?: string }>;
        openFile: () => Promise<{ success: boolean; message?: string }>;
        generate: () => Promise<{ success: boolean; message?: string }>;
      };

      // 系统相关API
      system: {
        openExternal: (url: string) => Promise<{ success: boolean; message?: string }>;
        showItemInFolder: (path: string) => Promise<{ success: boolean; message?: string }>;
        getVersion: () => Promise<{ success: boolean; data?: string }>;
        getPlatform: () => Promise<{ success: boolean; data?: string }>;
      };

      // 通用IPC
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
    };
  }
}

export {};
