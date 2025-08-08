# NetSniffer

一个基于 Electron + React + TypeScript + Whistle 的现代化桌面抓包工具，支持 HTTP/HTTPS 请求拦截和分析。

## 功能特性

- 🔒 **HTTPS 解密**: 自动生成和安装 CA 证书，支持 HTTPS 请求解密
- 📊 **实时抓包**: 实时捕获和显示网络请求
- 🔍 **详细分析**: 查看请求头、响应头、请求体、响应体
- 💾 **数据导出**: 支持 JSON 和 CSV 格式导出
- 🖥️ **跨平台**: 支持 macOS 和 Windows
- ⚡ **一键启动**: 自动配置系统代理，一键开始抓包

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式运行

```bash
pnpm dev
```

### 生产模式运行

```bash
pnpm start
```

### 构建与打包

```bash
# 编译代码（不生成安装包）
pnpm run build

# 生成安装包（按平台）
pnpm run dist:mac    # macOS
pnpm run dist:win    # Windows
pnpm run dist:linux  # Linux

# 多平台一次性
pnpm run dist        # macOS + Windows（参见 package.json）
```

详细的构建指南请参考 [构建指南](docs/BUILD_GUIDE.md)。

## 使用说明

1. **启动应用**: 运行 `npm run dev` 或 `npm run start`
2. **安装证书**: 点击"安装证书"按钮，自动安装 CA 证书
3. **开始抓包**: 点击"开始抓包"按钮，自动配置系统代理
4. **查看数据**: 在表格中查看捕获的请求数据
5. **查看详情**: 点击请求行查看详细的请求和响应信息
6. **导出数据**: 点击"导出数据"按钮保存抓包结果

## 技术栈

- **后端**: Electron + Node.js
- **前端**: React 18 + Ant Design + TypeScript
- **代理**: Whistle
- **构建**: Webpack 5 + electron-builder

## 项目结构

```
netsniffer/
├── src/
│   ├── main/              # Electron 主进程（TypeScript）
│   │   ├── api/           # IPC API 注册
│   │   ├── core/          # 业务核心（证书、代理）
│   │   ├── ipc-handlers/  # 旧版兼容处理（如有）
│   │   ├── preload.ts     # 预加载脚本
│   │   └── index.ts       # 主入口
│   └── renderer/          # 渲染进程（React + TS）
│       ├── components/    # 通用组件（工具栏、对话框等）
│       ├── extensions/    # 功能面板（抓包、证书、统计等）
│       ├── store/         # 状态管理（Zustand）
│       ├── styles/        # 样式
│       └── index.tsx      # 渲染入口
├── app/                   # 构建产物（Electron 启动目录）
├── certs/                 # 证书文件
├── .whistle/              # Whistle 配置
└── docs/                  # 文档（见 docs/README.md 索引）
```

## 开发指南

详细的开发文档请参考 `docs/` 目录：

- [开发指南](docs/DEVELOPMENT.md)
- [API文档](docs/API.md)
- [故障排除](docs/TROUBLESHOOTING.md)
- [部署指南](docs/DEPLOYMENT.md)

## 文档结构与清理说明

为精简仓库、避免历史临时说明混淆，已清理若干阶段性、临时性修复总结类 Markdown 文件，仅保留核心 README 与 `docs/` 下的正式文档。主要变更：

- 保留：`docs/` 下正式文档（API、开发、部署、故障排除等）
- 保留：根目录 `README.md`
- 移除：临时修复/阶段性总结类说明（如构建/证书/端口冲突的临时记录等）

如需查阅历史修复细节，请参阅提交记录（git history）。

## 许可证

MIT License 