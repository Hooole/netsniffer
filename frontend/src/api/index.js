// API 服务模块
// 在Electron环境中，这些API调用直接与主进程IPC通信

// 检查是否在Electron环境中
const isElectron = window.electronAPI !== undefined

// 通用API调用函数
async function callAPI(method, data = null) {
  if (isElectron) {
    // 在Electron环境中，使用IPC通信
    try {
      return await window.electronAPI[method](data)
    } catch (error) {
      console.error(`IPC调用失败 ${method}:`, error)
      return { success: false, message: error.message }
    }
  } else {
    // 在浏览器环境中，返回模拟数据（开发调试用）
    console.warn(`在浏览器环境中调用 ${method}，返回模拟数据`)
    return getMockData(method)
  }
}

// 模拟数据（用于浏览器环境调试）
function getMockData(method) {
  const mockData = {
    'get-certificate-status': {
      success: true,
      data: {
        exists: true,
        installed: { installed: false, location: null },
        info: { subject: 'RPA-AI MITM Proxy CA', issuer: 'RPA-AI MITM Proxy CA' },
        validation: { valid: true },
        guide: { title: '证书安装指导', steps: ['步骤1', '步骤2'] }
      }
    },
    'start-capture': {
      success: true,
      message: '抓包服务已启动（模拟）',
      proxySet: true
    },
    'stop-capture': {
      success: true,
      message: '抓包服务已停止（模拟）'
    },
    'get-captured-data': {
      success: true,
      data: []
    },
    'get-current-proxy': {
      success: true,
      data: { httpProxy: { Enabled: 'No', Server: '', Port: '' } }
    }
  }
  
  return mockData[method] || { success: false, message: '未知的API方法' }
}

// 抓包相关API
export const captureAPI = {
  // 开始抓包
  startCapture: (config) => callAPI('start-capture', config),
  
  // 停止抓包
  stopCapture: () => callAPI('stop-capture'),
  
  // 获取抓包数据
  getCapturedData: () => callAPI('get-captured-data'),
  
  // 导出数据
  exportData: (format) => callAPI('export-data', format),
  
  // 获取Whistle状态
  getWhistleStatus: () => callAPI('get-whistle-status'),
  
  // 清除抓包数据
  clearCapturedData: () => callAPI('clear-captured-data')
}

// 证书相关API
export const certificateAPI = {
  // 安装证书
  installCertificate: () => callAPI('install-certificate'),
  
  // 获取证书状态
  getCertificateStatus: () => callAPI('get-certificate-status'),
  
  // 打开证书文件
  openCertificateFile: () => callAPI('open-certificate-file')
}

// 代理相关API
export const proxyAPI = {
  // 获取当前代理设置
  getCurrentProxy: () => callAPI('get-current-proxy'),
  
  // 设置代理
  setProxy: (config) => callAPI('set-proxy', config),
  
  // 清除代理
  clearProxy: () => callAPI('clear-proxy')
}

// 默认导出
export default {
  capture: captureAPI,
  certificate: certificateAPI,
  proxy: proxyAPI
} 