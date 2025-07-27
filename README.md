# RPA-AI 抓包工具

一个基于 Electron + Vue.js + Whistle 的桌面抓包工具，支持 HTTP/HTTPS 请求拦截和分析。

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
npm install
```

### 开发模式运行

```bash
npm run dev
```

### 生产模式运行

```bash
npm run start
```

### 构建应用

```bash
# 构建当前平台
npm run build

# 构建特定平台
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux

# 构建所有平台
npm run build:all

# 使用构建脚本
node build/build.js mac   # macOS
node build/build.js win   # Windows
node build/build.js all   # 所有平台
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
- **前端**: Vue.js 3 + Element Plus
- **代理**: Whistle
- **构建**: Vue CLI + electron-builder

## 项目结构

```
rpa-ai/
├── src/                    # 源代码
│   ├── core/              # 核心模块
│   │   ├── whistle-proxy-server.js    # Whistle代理服务器
│   │   ├── certificate-manager.js     # 证书管理
│   │   └── data-exporter.js           # 数据导出
│   ├── main/              # Electron主进程
│   │   ├── main.js        # 窗口管理
│   │   ├── preload.js     # 预加载脚本
│   │   └── ipc-handlers/  # IPC通信处理
│   └── utils/             # 工具函数
├── frontend/              # Vue前端项目
│   └── src/
│       ├── components/    # Vue组件
│       └── App.vue        # 主应用组件
├── certs/                 # 证书文件
├── .whistle/             # Whistle配置
└── docs/                 # 项目文档
```

## 开发指南

详细的开发文档请参考 `docs/` 目录：

- [开发指南](docs/DEVELOPMENT.md)
- [API文档](docs/API.md)
- [故障排除](docs/TROUBLESHOOTING.md)
- [部署指南](docs/DEPLOYMENT.md)

## 许可证

MIT License 