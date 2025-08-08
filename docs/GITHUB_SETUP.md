# GitHub 设置和上传指南

本指南将帮助你将 NetSniffer 项目上传到 GitHub，并设置自动构建和发布。

## 📋 准备工作

### 1. 创建 GitHub 仓库

1. 登录 GitHub
2. 点击右上角的 "+" 号，选择 "New repository"
3. 填写仓库信息：
   - **Repository name**: `netsniffer`
   - **Description**: NetSniffer - 基于 Electron 的网络抓包工具
   - **Visibility**: Public 或 Private
   - **不要**勾选 "Add a README file"（我们已经有 README.md）
4. 点击 "Create repository"

### 2. 配置 Git 用户信息

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的邮箱"
```

## 🚀 上传项目到 GitHub

### 1. 初始化 Git 仓库

```bash
# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交初始代码
git commit -m "Initial commit: NetSniffer"
```

### 2. 连接到 GitHub 仓库

```bash
# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/netsniffer.git

# 推送到 GitHub
git push -u origin main
```

### 3. 创建第一个发布版本

```bash
# 使用发布脚本创建版本
node scripts/release.js patch

# 推送代码和标签
git push origin main
git push origin v1.0.1
```

## 🔧 GitHub Actions 配置

### 自动构建和发布

项目已配置 GitHub Actions 工作流，位于 `.github/workflows/build.yml`。

**触发条件**：
- 推送标签（如 `v1.0.0`）时自动构建和发布
- Pull Request 时运行测试

**构建平台**：
- ✅ macOS (Intel + Apple Silicon)
- ✅ Windows (x64)
- ✅ Linux (x64)

### 启用 GitHub Actions

1. 在 GitHub 仓库页面，点击 "Actions" 标签
2. 如果提示启用 Actions，点击 "Enable Actions"
3. 选择 "Build and Release" 工作流

## 📦 发布管理

### 版本管理

使用语义化版本号：
- **Major**: 重大更新，不兼容的 API 更改
- **Minor**: 新功能，向后兼容
- **Patch**: 错误修复，向后兼容

### 发布流程

```bash
# 1. 发布补丁版本 (1.0.0 -> 1.0.1)
node scripts/release.js patch

# 2. 发布次要版本 (1.0.0 -> 1.1.0)
node scripts/release.js minor

# 3. 发布主要版本 (1.0.0 -> 2.0.0)
node scripts/release.js major

# 4. 推送代码和标签
git push origin main
git push origin v1.0.1
```

### 自动发布

推送标签后，GitHub Actions 将：
1. 自动构建所有平台的应用
2. 创建 GitHub Release
3. 上传构建文件到 Release

## 📝 仓库设置

### 1. 仓库描述

在仓库设置中添加描述：
```
NetSniffer - 基于 Electron + React + TypeScript + Whistle 的桌面抓包软件，支持 HTTP/HTTPS 请求拦截和分析。
```

### 2. 主题标签

添加相关主题标签：
- `netsniffer`
- `electron`
- `packet-capture`
- `network-analysis`
- `http-proxy`
- `https-proxy`
- `mitm`
- `react`
- `element-plus`

### 3. 仓库网站

在仓库设置中启用 GitHub Pages：
- Source: Deploy from a branch
- Branch: main
- Folder: /docs

## 🔍 故障排除

### 常见问题

1. **推送失败**
   ```bash
   # 检查远程仓库配置
   git remote -v
   
   # 重新设置远程仓库
   git remote set-url origin https://github.com/YOUR_USERNAME/netsniffer.git
   ```

2. **GitHub Actions 失败**
   - 检查 Actions 日志
   - 确保 Node.js 版本兼容
   - 检查依赖安装

3. **权限问题**
   - 确保仓库有 Actions 权限
   - 检查 GitHub Token 配置

### 调试命令

```bash
# 检查 Git 状态
git status

# 检查远程仓库
git remote -v

# 检查标签
git tag -l

# 检查分支
git branch -a
```

## 📚 相关文档

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [GitHub Releases 文档](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [语义化版本](https://semver.org/lang/zh-CN/)

## 🎉 完成

上传完成后，你的项目将具备：

- ✅ 完整的版本控制
- ✅ 自动构建和发布
- ✅ 多平台支持
- ✅ 专业的项目展示
- ✅ 社区协作能力

现在你可以在 GitHub 上展示你的项目，并让其他开发者参与贡献！ 