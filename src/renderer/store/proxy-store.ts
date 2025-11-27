import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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
  
  // Actions
  setRunning: (running: boolean) => void;
  setConfig: (config: ProxyConfig | null) => void;
  setCapturedCount: (count: number) => void;
  setStatus: (status: ProxyStatus) => void;
  reset: () => void;
}

const initialState = {
  isRunning: false,
  config: null,
  capturedCount: 0,
};

export const useProxyStore = create<ProxyStore>()(
  devtools(
    (set) => ({
      ...initialState,
      
      setRunning: (running) => set({ isRunning: running }),
      
      setConfig: (config) => set({ config }),
      
      setCapturedCount: (count) => set({ capturedCount: count }),
      
      setStatus: (status) => set({
        isRunning: status.isRunning,
        config: status.config,
        capturedCount: status.capturedCount,
      }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'proxy-store',
    }
  )
);