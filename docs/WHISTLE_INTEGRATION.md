# Whistle 集成说明

## 概述

本项目使用 [Whistle](https://github.com/avwo/whistle) 作为核心代理服务器来实现 HTTP/HTTPS 抓包功能。Whistle 是一个强大的跨平台 Web 调试代理工具，支持 HTTPS 解密、请求拦截、响应修改等功能。

## 集成架构

### 1. 核心组件

- **WhistleProxyServer**: 管理 Whistle 进程和数据收集
- **CertificateManager**: 证书生成和管理
- **IPC Handlers**: 前端与后端的通信接口

### 2. 数据流

```
用户操作 → 前端组件 → IPC → 主进程 → Whistle进程 → 数据收集 → 前端展示
```

## 功能特性

### 1. HTTP/HTTPS 抓包
- 支持 HTTP 和 HTTPS 流量抓取
- 自动解密 HTTPS 流量
- 实时数据展示

### 2. 证书管理
- 自动生成 CA 证书
- 跨平台证书安装
- 证书状态检查

### 3. 代理管理
- 自动设置系统代理
- 启动时设置，停止时清除
- 支持 macOS 和 Windows

### 4. 数据导出
- JSON 格式导出
- CSV 格式导出
- 自定义保存路径

## 配置说明

### 1. Whistle 配置

配置文件位置：`.whistle/whistle.conf`

```bash
# 启用HTTPS解密
enableCaptureHttps true

# 设置证书路径
certPath ./certs/rootCA.crt
keyPath ./certs/rootCA.key

# 代理端口
port 7788

# 日志级别
logLevel info

# 数据存储
storage ./whistle-data
```

### 2. 证书配置

证书文件位置：`certs/`

- `rootCA.crt`: CA 证书文件
- `rootCA.key`: CA 私钥文件

## API 接口

### 抓包相关

```javascript
// 开始抓包
captureAPI.startCapture(config)

// 停止抓包
captureAPI.stopCapture()

// 获取抓包数据
captureAPI.getCapturedData()

// 导出数据
captureAPI.exportData(format)

// 获取Whistle状态
captureAPI.getWhistleStatus()

// 清除抓包数据
captureAPI.clearCapturedData()
```

### 证书相关

```javascript
// 安装证书
certificateAPI.installCertificate()

// 获取证书状态
certificateAPI.getCertificateStatus()

// 打开证书文件
certificateAPI.openCertificateFile()
```

### 代理相关

```javascript
// 获取当前代理设置
proxyAPI.getCurrentProxy()

// 设置代理
proxyAPI.setProxy(config)

// 清除代理
proxyAPI.clearProxy()
```

## 使用流程

### 1. 启动应用

```bash
npm run dev
```

### 2. 安装证书

点击"证书状态"按钮，然后点击"安装证书"。

### 3. 开始抓包

点击"开始抓包"按钮，系统会：
- 启动 Whistle 代理服务器
- 自动设置系统代理
- 开始捕获网络流量

### 4. 查看数据

访问任何网站，抓包数据会实时显示在列表中。

### 5. 导出数据

点击"导出数据"按钮，选择格式和保存位置。

## 故障排除

### 1. Whistle 启动失败

**问题**: Whistle 服务器启动超时

**解决方案**:
- 检查端口 7788 是否被占用
- 确保有足够的权限启动进程
- 查看控制台日志获取详细错误信息

### 2. HTTPS 抓包失败

**问题**: HTTPS 请求无法解密

**解决方案**:
- 确保证书已正确安装
- 重启浏览器
- 检查证书是否被系统信任

### 3. 代理设置失败

**问题**: 系统代理无法设置

**解决方案**:
- 检查管理员权限
- 手动设置系统代理
- 重启网络服务

### 4. 数据不显示

**问题**: 抓包数据不显示

**解决方案**:
- 检查 Whistle 是否正常运行
- 确认系统代理已设置
- 查看浏览器控制台错误

## 开发指南

### 1. 添加新功能

1. 在 `WhistleProxyServer` 中添加新方法
2. 在 IPC 处理器中添加新的处理器
3. 在前端 API 中添加新的接口
4. 在前端组件中添加新的功能

### 2. 调试技巧

1. **查看 Whistle 日志**:
   ```bash
   # 访问 Whistle 管理页面
   http://localhost:7788
   ```

2. **检查进程状态**:
   ```bash
   ps aux | grep whistle
   ```

3. **查看端口占用**:
   ```bash
   netstat -an | grep 7788
   ```

### 3. 性能优化

1. **数据收集频率**: 调整 `startDataCollector` 中的间隔时间
2. **内存管理**: 定期清理旧数据
3. **错误处理**: 添加重试机制和错误恢复

## 安全考虑

1. **证书安全**: CA 证书仅用于开发调试
2. **数据安全**: 抓包数据不发送到外部
3. **代理安全**: 仅监听本地连接
4. **权限控制**: 最小权限原则

## 更新日志

### v1.0.0
- 初始 Whistle 集成
- 支持 HTTP/HTTPS 抓包
- 自动证书管理
- 系统代理管理

## 参考资料

- [Whistle 官方文档](https://wproxy.org/whistle/)
- [Whistle GitHub](https://github.com/avwo/whistle)
- [Electron 文档](https://www.electronjs.org/docs)
- [Vue.js 文档](https://vuejs.org/guide/) 