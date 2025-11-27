import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 代理相关API
  proxy: {
    start: (config: any) => ipcRenderer.invoke('proxy:start', config),
    stop: () => ipcRenderer.invoke('proxy:stop'),
    getStatus: () => ipcRenderer.invoke('proxy:getStatus'),
    setSystemProxy: (config: any) => ipcRenderer.invoke('proxy:setSystemProxy', config),
    clearSystemProxy: () => ipcRenderer.invoke('proxy:clearSystemProxy'),
    getSystemProxyStatus: () => ipcRenderer.invoke('proxy:getSystemProxyStatus'),
  },

  // 抓包相关API
  capture: {
    getCapturedData: () => ipcRenderer.invoke('capture:getCapturedData'),
    clearCapturedData: () => ipcRenderer.invoke('capture:clearCapturedData'),
    exportData: (format: string) => ipcRenderer.invoke('capture:exportData', format),
    fetchWhistleSnapshot: () => ipcRenderer.invoke('capture:fetchWhistleSnapshot'),
    getWhistleRaw: (options?: any) => ipcRenderer.invoke('capture:getWhistleRaw', options || {}),
    resetWhistleCursor: () => ipcRenderer.invoke('capture:resetWhistleCursor'),
    onDataUpdate: (callback: (data: any[]) => void) => {
      const handler = (_: any, data: any[]) => callback(data);
      ipcRenderer.on('capture:dataUpdate', handler);
      return () => ipcRenderer.removeListener('capture:dataUpdate', handler);
    },
  },

  // 证书相关API
  certificate: {
    getStatus: () => ipcRenderer.invoke('certificate:getStatus'),
    install: () => ipcRenderer.invoke('certificate:install'),
    uninstall: () => ipcRenderer.invoke('certificate:uninstall'),
    openFile: () => ipcRenderer.invoke('certificate:openFile'),
    generate: () => ipcRenderer.invoke('certificate:generate'),
  },

  // 系统相关API
  system: {
    openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url),
    showItemInFolder: (path: string) => ipcRenderer.invoke('system:showItemInFolder', path),
    getVersion: () => ipcRenderer.invoke('system:getVersion'),
    getPlatform: () => ipcRenderer.invoke('system:getPlatform'),
  },

  // 通用IPC
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, callback: (...args: any[]) => void) => {
    const handler = (_: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
