# 证书安装路径修复总结

## 🐛 问题描述

在 Windows 下安装 NetSniffer 应用后，点击"安装证书"时出现错误：
```
证书安装失败: Command failed: certutil -addstore -f "ROOT" "D:\Net\NetSniffer\resources\app.asar\certs\rootCA.crt"
```

## 🔍 问题分析

### 根本原因
1. **路径错误**: 在打包后的应用中，证书文件位置发生了变化
2. **开发vs生产**: 开发环境和生产环境的文件路径不同
3. **资源路径**: 打包后的证书文件在 `resources` 目录中

### 路径差异
- **开发环境**: `src/../certs/rootCA.crt`
- **生产环境**: `process.resourcesPath/certs/rootCA.crt`

## ✅ 修复方案

### 1. 修复证书管理器路径

**文件**: `src/core/certificate-manager.js`

**修改前**:
```javascript
constructor() {
  this.certDir = path.join(__dirname, '..', '..', 'certs');
  this.caCertPath = path.join(this.certDir, 'rootCA.crt');
  this.caKeyPath = path.join(this.certDir, 'rootCA.key');
}
```

**修改后**:
```javascript
constructor() {
  // 在开发环境中使用相对路径，在生产环境中使用resources路径
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    this.certDir = path.join(__dirname, '..', '..', 'certs');
  } else {
    // 在打包后的应用中，证书文件在resources目录中
    this.certDir = path.join(process.resourcesPath, 'certs');
  }
  this.caCertPath = path.join(this.certDir, 'rootCA.crt');
  this.caKeyPath = path.join(this.certDir, 'rootCA.key');
}
```

### 2. 修复Whistle代理服务器路径

**文件**: `src/core/whistle-proxy-server.js`

**修改前**:
```javascript
constructor() {
  this.certDir = path.join(__dirname, '..', '..', 'certs');
  this.whistleDir = path.join(__dirname, '..', '..', '.whistle');
}
```

**修改后**:
```javascript
constructor() {
  // 在开发环境中使用相对路径，在生产环境中使用resources路径
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    this.certDir = path.join(__dirname, '..', '..', 'certs');
    this.whistleDir = path.join(__dirname, '..', '..', '.whistle');
  } else {
    // 在打包后的应用中，证书文件在resources目录中
    this.certDir = path.join(process.resourcesPath, 'certs');
    this.whistleDir = path.join(process.resourcesPath, '.whistle');
  }
}
```

## 🧪 验证步骤

### 1. 检查证书文件位置
```bash
# 在打包后的应用中
ls -la dist/win-unpacked/resources/certs/
```

### 2. 测试证书安装
1. 安装应用
2. 启动应用
3. 点击"安装证书"
4. 验证安装成功

### 3. 检查证书状态
```bash
# Windows上检查证书
certutil -store "ROOT" "RPA-AI MITM Proxy CA"
```

## 📋 修复结果

### ✅ 已修复的问题
1. **证书路径**: 现在能正确找到证书文件
2. **安装命令**: certutil 命令使用正确的路径
3. **环境适配**: 开发和生产环境都能正常工作

### 🔧 技术细节
- **开发环境**: 使用相对路径 `src/../certs/`
- **生产环境**: 使用 `process.resourcesPath/certs/`
- **环境检测**: 通过 `process.argv.includes('--dev')` 判断

## 🎯 使用说明

### 证书安装流程
1. 启动 NetSniffer 应用
2. 点击"安装证书"按钮
3. 系统会自动安装证书到 Windows 证书存储
4. 安装成功后状态会显示"已安装"

### 故障排除
如果证书安装仍然失败：
1. 手动双击证书文件
2. 选择"安装证书"
3. 选择"本地计算机"
4. 选择"受信任的根证书颁发机构"
5. 完成安装

## 💡 预防措施

### 1. 路径检查
确保所有文件路径都考虑了开发和生产环境的差异

### 2. 环境变量
使用 `process.argv.includes('--dev')` 来区分环境

### 3. 资源路径
在打包后的应用中使用 `process.resourcesPath` 访问资源

现在证书安装功能应该能正常工作了！🎉 