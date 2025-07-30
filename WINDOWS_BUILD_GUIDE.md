# Windows 桌面应用打包指南

## 🎯 目标

将 NetSniffer 项目打包成 Windows 桌面应用，生成可安装的 `.exe` 文件。

## 📋 前置条件

### 1. 系统要求
- **操作系统**: macOS 或 Linux（推荐 macOS）
- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0

### 2. 依赖安装
```bash
# 安装项目依赖
npm install

# 安装前端依赖
cd frontend && npm install && cd ..
```

## 🚀 打包步骤

### 步骤 1: 构建前端
```bash
# 构建 Vue 前端项目
npm run build:frontend
```

### 步骤 2: 生成图标（可选）
```bash
# 生成基础图标
node build/generate-icons.js

# 生成 Windows 图标
node build/create-windows-icon.js
```

### 步骤 3: 打包 Windows 应用
```bash
# 方法一：完整打包（推荐）
npm run build:win

# 方法二：仅打包不压缩
npm run package:win
```

## 📦 打包输出

### 生成的文件
- **位置**: `dist/` 目录
- **文件类型**:
  - `NetSniffer Setup.exe` - Windows 安装程序
  - `NetSniffer.exe` - 便携版应用

### 安装程序特性
- ✅ 自定义安装目录
- ✅ 创建桌面快捷方式
- ✅ 创建开始菜单快捷方式
- ✅ 支持卸载

## 🔧 高级配置

### 自定义打包配置
编辑 `package.json` 中的 `build.win` 部分：

```json
{
  "build": {
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        },
        {
          "target": "portable", 
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico"
    }
  }
}
```

### NSIS 安装程序配置
```json
{
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "NetSniffer"
  }
}
```

## 🐛 常见问题

### 问题 1: 构建失败
**错误**: `electron` 依赖配置错误
**解决**: 确保 `electron` 在 `devDependencies` 中

### 问题 2: 图标不显示
**错误**: 图标文件不存在或格式错误
**解决**: 运行 `node build/create-windows-icon.js`

### 问题 3: 应用无法启动
**错误**: 缺少必要文件
**解决**: 检查 `package.json` 中的 `files` 配置

## 📋 验证步骤

### 1. 检查构建输出
```bash
ls -la dist/
```

### 2. 测试安装程序
- 在 Windows 系统上运行 `NetSniffer Setup.exe`
- 验证安装和卸载功能

### 3. 测试便携版
- 运行 `NetSniffer.exe`
- 验证应用功能正常

## 🎉 完成

打包完成后，你将获得：
- ✅ Windows 安装程序
- ✅ 便携版应用
- ✅ 完整的安装体验
- ✅ 应用图标和快捷方式

## 📝 注意事项

1. **图标质量**: 当前使用的是占位符图标，建议使用专业工具设计更好的图标
2. **文件大小**: 首次打包可能需要下载 Electron 二进制文件，请保持网络连接
3. **杀毒软件**: 某些杀毒软件可能误报，这是正常现象
4. **权限**: 应用需要网络访问权限来执行抓包功能

## 🔄 更新版本

要更新应用版本：
1. 修改 `package.json` 中的 `version` 字段
2. 重新运行打包命令
3. 生成新的安装程序

现在你可以开始打包 Windows 版本了！🎉 