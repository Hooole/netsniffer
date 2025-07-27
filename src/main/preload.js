const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 抓包相关
  'start-capture': (config) => ipcRenderer.invoke('start-capture', config),
  'stop-capture': () => ipcRenderer.invoke('stop-capture'),
  'get-captured-data': () => ipcRenderer.invoke('get-captured-data'),
  'export-data': (format) => ipcRenderer.invoke('export-data', format),
  'get-whistle-status': () => ipcRenderer.invoke('get-whistle-status'),
  'clear-captured-data': () => ipcRenderer.invoke('clear-captured-data'),
  
  // 证书相关
  'install-certificate': () => ipcRenderer.invoke('install-certificate'),
  'get-certificate-status': () => ipcRenderer.invoke('get-certificate-status'),
  'open-certificate-file': () => ipcRenderer.invoke('open-certificate-file'),
  
  // 代理相关
  'get-current-proxy': () => ipcRenderer.invoke('get-current-proxy'),
  'set-proxy': (config) => ipcRenderer.invoke('set-proxy', config),
  'clear-proxy': () => ipcRenderer.invoke('clear-proxy')
}); 