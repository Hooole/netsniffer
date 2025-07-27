# 跨平台构建功能总结

## 🎯 功能概述

项目现已支持完整的跨平台桌面应用构建，可以生成 Windows、macOS 和 Linux 平台的安装包。

## 📋 构建配置

### 支持的平台
- ✅ **macOS**: Intel (x64) 和 Apple Silicon (arm64)
- ✅ **Windows**: x64 架构
- ✅ **Linux**: x64 架构

### 构建格式
- **macOS**: DMG 安装包 + ZIP 压缩包
- **Windows**: NSIS 安装程序 + 便携版 ZIP
- **Linux**: AppImage + DEB 包

## 🛠️ 构建工具

### 1. 构建脚本
- `build/build.js` - 自动化构建脚本
- `build/test-build.js` - 构建配置检查
- `build/generate-icons.js` - 图标生成工具

### 2. 配置文件
- `build/entitlements.mac.plist` - macOS 权限配置
- `package.json` - electron-builder 配置

## 🚀 使用方法

### 快速构建
```bash
# 构建当前平台
npm run build

# 构建特定平台
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux

# 构建所有平台
npm run build:all
```

### 使用构建脚本
```bash
# 检查构建配置
node build/test-build.js

# 生成图标
node build/generate-icons.js

# 自动化构建
node build/build.js mac   # macOS
node build/build.js win   # Windows
node build/build.js all   # 所有平台
```

## 📦 构建输出

构建完成后，应用文件位于 `dist/` 目录：

### macOS
- `RPA-AI 抓包工具-1.0.0.dmg` - 安装包
- `RPA-AI 抓包工具-1.0.0-mac.zip` - 压缩包

### Windows
- `RPA-AI 抓包工具 Setup 1.0.0.exe` - 安装程序
- `RPA-AI 抓包工具-1.0.0-win.zip` - 便携版

### Linux
- `RPA-AI 抓包工具-1.0.0.AppImage` - AppImage 格式
- `rpa-ai-packet-capture_1.0.0_amd64.deb` - Debian 包

## 🔧 配置详情

### electron-builder 配置
- **应用信息**: 产品名称、版本、描述
- **文件包含**: 主进程代码、证书、Whistle 配置
- **平台特定**: 图标、权限、安装选项
- **代码签名**: 支持 macOS 和 Windows 签名

### 权限配置
- **macOS**: 网络访问、文件读写、JIT 编译
- **Windows**: 管理员权限、桌面快捷方式
- **Linux**: 应用分类、图标设置

## 📋 构建检查清单

### 构建前检查
- [ ] 依赖安装完成 (`npm install`)
- [ ] 前端依赖安装完成 (`cd frontend && npm install`)
- [ ] 前端构建完成 (`npm run build:frontend`)
- [ ] 图标文件准备 (可选)
- [ ] 证书文件存在 (`certs/` 目录)

### 构建后验证
- [ ] 应用文件生成 (`dist/` 目录)
- [ ] 应用可以正常启动
- [ ] 核心功能正常工作
- [ ] 证书安装功能正常
- [ ] 抓包功能正常

## 🔍 故障排除

### 常见问题
1. **构建失败**: 检查 Node.js 版本和依赖
2. **图标问题**: 确保图标文件格式正确
3. **权限问题**: macOS 可能需要开发者证书
4. **依赖问题**: 删除 `node_modules` 重新安装

### 调试命令
```bash
# 查看详细构建日志
DEBUG=electron-builder npm run build:mac

# 清理构建缓存
rm -rf dist/ node_modules/.cache

# 检查构建配置
node build/test-build.js
```

## 📚 相关文档

- [构建指南](docs/BUILD_GUIDE.md) - 详细构建说明
- [开发指南](docs/DEVELOPMENT.md) - 开发环境配置
- [部署指南](docs/DEPLOYMENT.md) - 发布和部署
- [故障排除](docs/TROUBLESHOOTING.md) - 问题解决方案

## 🎉 总结

项目现已具备完整的跨平台构建能力：

- ✅ **自动化构建**: 一键构建多平台应用
- ✅ **配置检查**: 构建前自动检查配置
- ✅ **图标生成**: 自动生成应用图标
- ✅ **权限配置**: 平台特定的权限设置
- ✅ **安装包**: 生成标准的安装程序
- ✅ **文档完善**: 详细的构建指南

现在你可以轻松地为 Windows 和 macOS 用户构建桌面应用了！ 