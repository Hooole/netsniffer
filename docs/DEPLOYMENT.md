# 部署指南

## 概述

本文档介绍如何构建、打包和分发 RPA-AI 抓包工具。

## 构建环境

### 系统要求

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **操作系统**: macOS, Windows, Linux

### 依赖安装

```bash
# 安装项目依赖
npm install

# 安装 Electron 依赖
npm run postinstall
```

## 构建配置

### 基本配置

项目使用 `electron-builder` 进行构建，配置文件位于 `package.json` 的 `build` 字段：

```json
{
  "build": {
    "appId": "com.rpa-ai.packet-capture",
    "productName": "RPA-AI 抓包工具",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "src/**/*",
      "assets/**/*",
      "certs/**/*",
      "node_modules/**/*",
      "package.json"
    ]
  }
}
```

### 平台特定配置

#### macOS 配置
```json
{
  "mac": {
    "category": "public.app-category.developer-tools",
    "icon": "assets/icon.icns",
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      },
      {
        "target": "zip",
        "arch": ["x64", "arm64"]
      }
    ]
  }
}
```

#### Windows 配置
```json
{
  "win": {
    "icon": "assets/icon.ico",
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      },
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ]
  }
}
```

#### Linux 配置
```json
{
  "linux": {
    "icon": "assets/icon.png",
    "target": [
      {
        "target": "AppImage",
        "arch": ["x64"]
      },
      {
        "target": "deb",
        "arch": ["x64"]
      }
    ],
    "category": "Development"
  }
}
```

## 构建流程

### 1. 开发构建

```bash
# 构建应用（不打包）
npm run build

# 构建并打包
npm run package
```

### 2. 平台特定构建

```bash
# macOS
npm run build:mac
npm run package:mac

# Windows
npm run build:win
npm run package:win

# Linux
npm run build:linux
npm run package:linux

# 所有平台
npm run build:all
```

### 3. 构建输出

构建完成后，文件将输出到 `dist` 目录：

```
dist/
├── mac/                 # macOS 构建文件
│   ├── RPA-AI 抓包工具.app
│   ├── RPA-AI 抓包工具-1.0.0.dmg
│   └── RPA-AI 抓包工具-1.0.0-mac.zip
├── win/                 # Windows 构建文件
│   ├── RPA-AI 抓包工具 Setup 1.0.0.exe
│   └── RPA-AI 抓包工具.exe
└── linux/              # Linux 构建文件
    ├── RPA-AI 抓包工具-1.0.0.AppImage
    └── rpa-ai-packet-capture_1.0.0_amd64.deb
```

## 签名和公证

### macOS 签名

#### 1. 获取开发者证书

```bash
# 查看可用证书
security find-identity -v -p codesigning

# 或使用 Apple Developer 证书
# 需要在 Apple Developer 网站申请证书
```

#### 2. 配置签名

```json
{
  "mac": {
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  }
}
```

#### 3. 创建授权文件

```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
  </dict>
</plist>
```

#### 4. 执行签名

```bash
# 使用 electron-builder 自动签名
npm run build:mac

# 或手动签名
codesign --force --deep --sign "Developer ID Application: Your Name" "dist/mac/RPA-AI 抓包工具.app"
```

### Windows 签名

#### 1. 获取代码签名证书

- 从证书颁发机构购买代码签名证书
- 或使用自签名证书（仅用于测试）

#### 2. 配置签名

```json
{
  "win": {
    "certificateFile": "path/to/certificate.p12",
    "certificatePassword": "password"
  }
}
```

#### 3. 执行签名

```bash
# 使用 electron-builder 自动签名
npm run build:win

# 或手动签名
signtool sign /f certificate.p12 /p password "dist/win/RPA-AI 抓包工具 Setup 1.0.0.exe"
```

## 自动化构建

### GitHub Actions

创建 `.github/workflows/build.yml`：

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build:${{ matrix.os == 'macos-latest' && 'mac' || matrix.os == 'windows-latest' && 'win' || 'linux' }}
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: ${{ matrix.os }}-build
        path: dist/
```

### 本地自动化脚本

创建 `scripts/build-all.js`：

```javascript
const { execSync } = require('child_process');
const fs = require('fs-extra');

async function buildAll() {
  console.log('开始构建所有平台...');
  
  // 清理构建目录
  await fs.remove('dist');
  
  // 构建 macOS
  console.log('构建 macOS...');
  execSync('npm run build:mac', { stdio: 'inherit' });
  
  // 构建 Windows
  console.log('构建 Windows...');
  execSync('npm run build:win', { stdio: 'inherit' });
  
  // 构建 Linux
  console.log('构建 Linux...');
  execSync('npm run build:linux', { stdio: 'inherit' });
  
  console.log('所有平台构建完成！');
}

buildAll().catch(console.error);
```

## 分发策略

### 1. 应用商店分发

#### macOS App Store

1. 注册 Apple Developer 账号
2. 创建 App Store Connect 应用
3. 上传构建的应用
4. 通过审核后发布

#### Microsoft Store

1. 注册 Microsoft Partner Center 账号
2. 创建应用提交
3. 上传应用包
4. 通过认证后发布

### 2. 直接分发

#### 官方网站

1. 在项目网站提供下载链接
2. 使用 CDN 加速下载
3. 提供安装说明

#### GitHub Releases

1. 创建 Release
2. 上传构建文件
3. 编写更新说明

```bash
# 创建 Release
gh release create v1.0.0 dist/* --title "v1.0.0" --notes "更新说明"
```

### 3. 包管理器分发

#### Homebrew (macOS)

```bash
# 创建 Formula
brew create --tap your-username/homebrew-tap rpa-ai-packet-capture

# 安装
brew install your-username/tap/rpa-ai-packet-capture
```

#### Chocolatey (Windows)

```xml
<!-- rpa-ai-packet-capture.nuspec -->
<?xml version="1.0"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>rpa-ai-packet-capture</id>
    <version>1.0.0</version>
    <title>RPA-AI 抓包工具</title>
    <description>基于 Electron 的网络抓包软件</description>
  </metadata>
  <files>
    <file src="tools\**" target="tools" />
  </files>
</package>
```

## 更新机制

### 1. 自动更新

#### 配置自动更新

```javascript
// main.js
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();
```

#### 更新服务器

1. 使用 GitHub Releases 作为更新源
2. 或搭建私有更新服务器
3. 配置更新检查频率

### 2. 手动更新

1. 在应用中提供检查更新功能
2. 引导用户下载新版本
3. 提供更新说明

## 安全考虑

### 1. 代码签名

- 对所有平台的应用进行代码签名
- 使用可信的证书颁发机构
- 定期更新签名证书

### 2. 安全扫描

```bash
# 扫描恶意软件
# macOS
xattr -cr "dist/mac/RPA-AI 抓包工具.app"

# Windows
# 使用 Windows Defender 或其他安全软件扫描
```

### 3. 权限最小化

- 只请求必要的系统权限
- 明确说明权限用途
- 提供权限说明文档

## 性能优化

### 1. 构建优化

```json
{
  "build": {
    "compression": "maximum",
    "removePackageScripts": true,
    "removePackageKeywords": true
  }
}
```

### 2. 文件大小优化

- 移除不必要的依赖
- 使用动态导入
- 压缩资源文件

### 3. 启动优化

- 使用 V8 快照
- 延迟加载非关键模块
- 优化资源加载

## 监控和分析

### 1. 错误监控

```javascript
// 集成错误监控服务
const { crashReporter } = require('electron');

crashReporter.start({
  productName: 'RPA-AI 抓包工具',
  companyName: 'RPA-AI Team',
  submitURL: 'https://your-error-tracking-service.com'
});
```

### 2. 使用统计

- 收集匿名使用数据
- 监控应用性能
- 分析用户行为

## 维护和更新

### 1. 版本管理

- 使用语义化版本号
- 维护更新日志
- 提供迁移指南

### 2. 兼容性

- 测试不同系统版本
- 确保向后兼容
- 提供降级方案

### 3. 文档更新

- 同步更新用户文档
- 维护开发者文档
- 提供故障排除指南

## 最佳实践

### 1. 构建流程

1. 在干净环境中构建
2. 测试所有平台版本
3. 验证签名和公证
4. 进行安全扫描

### 2. 发布流程

1. 创建 Release 分支
2. 更新版本号
3. 构建所有平台
4. 上传到分发渠道
5. 通知用户更新

### 3. 质量保证

1. 自动化测试
2. 手动功能测试
3. 性能测试
4. 安全测试

## 常见问题

### Q: 构建失败怎么办？

A: 检查 Node.js 版本、依赖安装、网络连接等。

### Q: 签名失败怎么办？

A: 检查证书有效性、权限设置、签名配置等。

### Q: 应用被误报怎么办？

A: 提交到安全软件白名单、提供安全说明等。

### Q: 更新不工作怎么办？

A: 检查更新服务器配置、网络连接、权限设置等。 