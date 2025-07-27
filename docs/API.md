# API 文档

## 概述

本文档描述了 RPA-AI 抓包工具的 API 接口，包括主进程和渲染进程之间的 IPC 通信接口。

## IPC 接口

### 抓包相关接口

#### start-capture
启动抓包服务

**参数:**
- `config` (Object): 配置对象
  - `port` (number): 代理端口，默认 7788
  - `filter` (string): 域名过滤规则（可选）

**返回值:**
```javascript
{
  success: boolean,
  message: string
}
```

**示例:**
```javascript
const result = await window.electronAPI.startCapture({
  port: 7788,
  filter: 'example.com'
});
```

#### stop-capture
停止抓包服务

**参数:** 无

**返回值:**
```javascript
{
  success: boolean,
  message: string
}
```

**示例:**
```javascript
const result = await window.electronAPI.stopCapture();
```

#### get-captured-data
获取抓包数据

**参数:** 无

**返回值:**
```javascript
Array<{
  timestamp: string,
  method: string,
  url: string,
  host: string,
  protocol: string,
  statusCode: number,
  headers: Object,
  responseHeaders: Object,
  requestBody: string,
  responseBody: string
}>
```

**示例:**
```javascript
const data = await window.electronAPI.getCapturedData();
```

#### export-data
导出抓包数据

**参数:**
- `format` (string): 导出格式，支持 'json' 或 'csv'

**返回值:**
```javascript
{
  success: boolean,
  message: string
}
```

**示例:**
```javascript
const result = await window.electronAPI.exportData('json');
```

### 证书管理接口

#### install-certificate
安装 CA 证书

**参数:** 无

**返回值:**
```javascript
{
  success: boolean,
  message: string,
  location?: string,
  manualSteps?: string[]
}
```

**示例:**
```javascript
const result = await window.electronAPI.installCertificate();
```

#### get-certificate-status
获取证书状态

**参数:** 无

**返回值:**
```javascript
{
  success: boolean,
  data: {
    exists: boolean,
    installed: {
      installed: boolean,
      location: string
    },
    info: {
      subject: string,
      issuer: string,
      validFrom: string,
      validTo: string,
      serialNumber: string
    },
    validation: {
      valid: boolean,
      error?: string
    },
    guide: {
      title: string,
      steps: string[],
      manualCommand: string
    }
  }
}
```

**示例:**
```javascript
const result = await window.electronAPI.getCertificateStatus();
```

#### open-certificate-file
打开证书文件

**参数:** 无

**返回值:**
```javascript
{
  success: boolean,
  message: string
}
```

**示例:**
```javascript
const result = await window.electronAPI.openCertificateFile();
```

### 代理管理接口

#### get-current-proxy
获取当前代理设置

**参数:** 无

**返回值:**
```javascript
{
  success: boolean,
  data: {
    networkService: string,
    httpProxy: {
      Enabled: string,
      Server: string,
      Port: string
    },
    httpsProxy: {
      Enabled: string,
      Server: string,
      Port: string
    }
  }
}
```

**示例:**
```javascript
const result = await window.electronAPI.getCurrentProxy();
```

#### set-proxy
手动设置代理

**参数:**
- `host` (string): 代理主机地址
- `port` (number): 代理端口

**返回值:**
```javascript
{
  success: boolean,
  message: string,
  networkService?: string
}
```

**示例:**
```javascript
const result = await window.electronAPI.setProxy('127.0.0.1', 7788);
```

#### clear-proxy
清除代理设置

**参数:** 无

**返回值:**
```javascript
{
  success: boolean,
  message: string
}
```

**示例:**
```javascript
const result = await window.electronAPI.clearProxy();
```

## 错误处理

所有 API 接口都遵循统一的错误处理模式：

### 成功响应
```javascript
{
  success: true,
  message: "操作成功",
  data: {} // 可选的数据
}
```

### 错误响应
```javascript
{
  success: false,
  message: "错误描述"
}
```

### 异常处理
```javascript
try {
  const result = await window.electronAPI.someMethod();
  if (result.success) {
    // 处理成功情况
  } else {
    // 处理错误情况
    console.error(result.message);
  }
} catch (error) {
  // 处理异常
  console.error('API调用失败:', error);
}
```

## 数据类型

### 抓包数据项
```javascript
{
  timestamp: string,        // ISO 8601 时间戳
  method: string,          // HTTP 方法 (GET, POST, etc.)
  url: string,             // 完整 URL
  host: string,            // 主机名
  protocol: string,        // 协议 (http/https)
  statusCode: number,      // HTTP 状态码
  headers: Object,         // 请求头
  responseHeaders: Object, // 响应头
  requestBody: string,     // 请求体
  responseBody: string     // 响应体
}
```

### 配置对象
```javascript
{
  port: number,    // 代理端口
  filter: string   // 域名过滤规则
}
```

## 注意事项

1. **异步操作**: 所有 API 接口都是异步的，需要使用 `await` 或 `.then()` 处理
2. **错误处理**: 始终检查返回值的 `success` 字段
3. **数据序列化**: 传递给 API 的数据必须是可序列化的
4. **权限要求**: 某些操作（如证书安装）可能需要管理员权限
5. **平台差异**: 某些功能在不同操作系统上可能有差异

## 示例代码

### 完整的抓包流程
```javascript
// 1. 检查证书状态
const certStatus = await window.electronAPI.getCertificateStatus();
if (!certStatus.data.installed.installed) {
  // 安装证书
  await window.electronAPI.installCertificate();
}

// 2. 启动抓包
const startResult = await window.electronAPI.startCapture({
  port: 7788
});

if (startResult.success) {
  // 3. 定期获取数据
  setInterval(async () => {
    const data = await window.electronAPI.getCapturedData();
    console.log('抓包数据:', data);
  }, 1000);
  
  // 4. 停止抓包
  setTimeout(async () => {
    await window.electronAPI.stopCapture();
  }, 60000);
}
```

### 数据导出
```javascript
// 导出为 JSON
const jsonResult = await window.electronAPI.exportData('json');
if (jsonResult.success) {
  console.log('JSON 导出成功');
}

// 导出为 CSV
const csvResult = await window.electronAPI.exportData('csv');
if (csvResult.success) {
  console.log('CSV 导出成功');
}
``` 