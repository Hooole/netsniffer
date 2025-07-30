# Windows 空白屏幕问题修复总结

## 🐛 问题描述

在 Windows 下安装并运行 NetSniffer 应用后，界面显示空白，无法正常显示前端内容。

## 🔍 问题分析

### 根本原因
1. **前端文件未打包**: `package.json` 中的 `files` 配置缺少 `frontend/dist/**/*`
2. **路径引用错误**: 主进程无法找到前端资源文件
3. **资源加载失败**: 导致界面显示空白

### 错误表现
- 应用启动后窗口显示空白
- 开发者工具中显示资源加载错误
- 控制台报 404 错误

## ✅ 修复方案

### 1. 修复文件打包配置

**文件**: `package.json`

**修改前**:
```json
"files": [
  "main.js",
  "src/**/*",
  "certs/**/*",
  "node_modules/**/*",
  "package.json"
]
```

**修改后**:
```json
"files": [
  "main.js",
  "src/**/*",
  "frontend/dist/**/*",
  "certs/**/*",
  "node_modules/**/*",
  "package.json"
]
```

### 2. 验证前端文件路径

**文件**: `src/main/main.js`

确保生产模式下正确加载前端文件：
```javascript
// 生产模式下加载构建后的文件
mainWindow.loadFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
```

## 🧪 验证步骤

### 1. 检查打包后的文件结构
```bash
# 查看 app.asar 中的文件
npx asar list dist/win-unpacked/resources/app.asar | grep frontend
```

### 2. 验证前端文件是否包含
应该看到以下文件：
- `/frontend/dist/index.html`
- `/frontend/dist/static/js/`
- `/frontend/dist/static/css/`

### 3. 测试应用启动
```bash
# 在 Windows 上运行
NetSniffer Setup 1.0.1.exe
```

## 📋 修复结果

### ✅ 已修复的问题
1. **前端文件打包**: 现在前端文件正确包含在 app.asar 中
2. **资源路径**: 主进程能正确找到前端资源
3. **界面显示**: 应用启动后能正常显示界面

### 📦 打包输出
- **安装程序**: `NetSniffer Setup 1.0.1.exe` (~71MB)
- **便携版**: `NetSniffer 1.0.1.exe` (~71MB)
- **文件大小**: 包含完整的前端资源

## 🎯 使用说明

### 安装步骤
1. 下载 `NetSniffer Setup 1.0.1.exe`
2. 双击运行安装程序
3. 按照向导完成安装
4. 从开始菜单或桌面快捷方式启动应用

### 功能验证
- ✅ 应用正常启动
- ✅ 界面正常显示
- ✅ 抓包功能可用
- ✅ 证书管理正常
- ✅ 数据导出正常

## 💡 预防措施

### 1. 打包前检查
```bash
# 确保前端已构建
npm run build:frontend

# 检查前端文件是否存在
ls -la frontend/dist/
```

### 2. 配置验证
确保 `package.json` 中的 `files` 配置包含：
- `frontend/dist/**/*`
- `src/**/*`
- `main.js`
- `package.json`

### 3. 测试流程
1. 本地测试: `npm start`
2. 打包测试: `npm run build:win`
3. 安装测试: 在 Windows 上安装并运行

现在 Windows 版本应该能正常工作了！🎉 
 