# 构建指南

本指南将帮助你构建 NetSniffer 的桌面应用程序，支持 Windows、macOS 和 Linux 平台。

## 环境要求

### 基础要求

- Node.js 16+
- npm 8+
- Git

### 平台特定要求

#### Windows

- Windows 10/11 (64位)
- Visual Studio Build Tools (可选，用于原生模块编译)

#### macOS

- macOS 10.15+ (Catalina)
- Xcode Command Line Tools
- 支持 Intel 和 Apple Silicon (M1/M2)

#### Linux

- Ubuntu 18.04+ / CentOS 7+ / Fedora 30+
- 开发工具包

## 安装依赖

```bash
# 安装项目依赖
npm install
```

## 构建流程

### 1. 生成图标

首先生成应用图标：

```bash
node build/generate-icons.js
```

然后使用在线工具或 ImageMagick 将 SVG 转换为所需格式：

- `build/icon.ico` (Windows)
- `build/icon.png` (Linux)
- `build/icon.icns` (macOS)

### 2. 构建前端

前端代码已集成在主项目中，使用 Webpack 构建。

### 3. 构建桌面应用

#### 构建特定平台

```bash
# macOS
npm run dist:mac

# Windows
npm run dist:win

# Linux
npm run dist:linux
```

#### 多平台打包

```bash
npm run dist
```

#### 使用构建脚本

```bash
# 构建 macOS 应用
node build/build.js mac

# 构建 Windows 应用
node build/build.js win

# 构建 Linux 应用
node build/build.js linux

# 构建所有平台
node build/build.js all
```

## 构建输出

构建完成后，应用文件将位于 `dist/` 目录：

### macOS

- `NetSniffer-1.0.0.dmg` - 安装包
- `NetSniffer-1.0.0-mac.zip` - 压缩包

### Windows

- `NetSniffer Setup 1.0.0.exe` - 安装程序
- `NetSniffer-1.0.0-win.zip` - 便携版

### Linux

- `NetSniffer-1.0.0.AppImage` - AppImage 格式
- `airesident_1.0.0_amd64.deb` - Debian 包

## 代码签名 (可选)

### macOS 代码签名

1. 获取 Apple Developer 证书
2. 在 `package.json` 中添加签名配置：

```json
{
  "build": {
    "mac": {
      "identity": "你的开发者ID"
    }
  }
}
```

### Windows 代码签名

1. 获取代码签名证书
2. 在 `package.json` 中添加签名配置：

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.p12",
      "certificatePassword": "证书密码"
    }
  }
}
```

## 发布配置

### 自动更新

要启用自动更新，需要在 `package.json` 中配置：

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "你的GitHub用户名",
      "repo": "netsniffer"
    }
  }
}
```

### 应用元数据

在 `package.json` 中配置应用信息：

```json
{
  "name": "netsniffer",
  "version": "1.0.0",
  "description": "NetSniffer",
  "author": {
    "name": "NetSniffer Team",
    "email": "team@rpa-ai.com"
  },
  "homepage": "https://github.com/your-username/netsniffer"
}
```

## 故障排除

### 常见问题

1. **构建失败**: 检查 Node.js 版本和依赖安装
2. **图标问题**: 确保图标文件存在且格式正确
3. **权限问题**: macOS 可能需要开发者证书
4. **依赖问题**: 删除 `node_modules` 重新安装

### 调试构建

```bash
# 查看详细构建日志
DEBUG=electron-builder npm run dist:mac

# 清理构建缓存
rm -rf dist/ node_modules/.cache
```

## 持续集成

### GitHub Actions 示例

```yaml
name: Build Desktop App

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'

      - run: npm ci

      - name: Build app
        run: npm run ${{ matrix.os == 'macos-latest' && 'dist:mac' || matrix.os == 'windows-latest' && 'dist:win' || 'dist:linux' }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: app-${{ matrix.os }}
          path: dist/
```

## 最佳实践

1. **版本管理**: 使用语义化版本号
2. **测试**: 构建前确保应用功能正常
3. **文档**: 更新用户文档和发布说明
4. **备份**: 保留构建配置和脚本
5. **自动化**: 使用 CI/CD 自动化构建流程
