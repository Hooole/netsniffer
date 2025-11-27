# 开发指南

## 开发环境设置

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git

### 克隆项目

```bash
git clone <repository-url>
cd netsniffer
npm install
```

### 开发模式

```bash
# 启动开发模式
npm run dev

# 启动开发模式（打开开发者工具）
npm run electron-dev
```

## 项目架构

### 目录结构

```
src/
├── main/                   # 主进程（TypeScript）
│   ├── api/               # IPC API 注册
│   ├── core/              # 业务核心（证书、代理等）
│   ├── ipc-handlers/      # 旧版兼容处理（如有）
│   ├── preload.ts         # 预加载脚本
│   └── index.ts           # 主入口
├── renderer/               # 渲染进程（React + TypeScript）
│   ├── components/        # 通用组件（工具栏、对话框等）
│   ├── extensions/        # 功能面板（抓包、证书、统计、设置等）
│   ├── store/             # 状态管理（Zustand）
│   ├── styles/            # 样式（Less/CSS）
│   ├── index.html         # 渲染页模板
│   └── index.tsx          # 渲染入口
└── types/                 # 公共类型声明
```

### 架构说明

#### 主进程 (Main Process)

- 负责创建和管理应用窗口
- 处理系统级操作（文件、网络、证书等）
- 管理 IPC 通信

#### 渲染进程 (Renderer Process)

- 负责用户界面渲染
- 处理用户交互
- 通过 IPC 与主进程通信

#### 核心模块

- **ProxyServer**: HTTP/HTTPS 代理服务器
- **CertificateManager**: 证书生成和管理
- **DataExporter**: 数据导出功能

## 开发规范

### 代码风格

#### JavaScript/Node.js

- 使用 ES6+ 语法
- 使用 `const` 和 `let`，避免 `var`
- 使用箭头函数
- 使用 async/await 处理异步操作
- 添加适当的 JSDoc 注释

```javascript
/**
 * 示例函数
 * @param {string} name 名称
 * @param {number} age 年龄
 * @returns {Promise<string>} 结果
 */
const exampleFunction = async (name, age) => {
  try {
    const result = await someAsyncOperation(name, age);
    return result;
  } catch (error) {
    logger.error('操作失败', error);
    throw error;
  }
};
```

#### React + TypeScript

- 使用函数组件与 Hooks
- 使用 Ant Design 5 组件库
- 状态管理使用 Zustand
- 组件名使用 PascalCase；文件名建议 PascalCase.tsx 或 kebab-case.tsx

```tsx
import React from 'react';
import { Button, message } from 'antd';

export const ExampleComponent: React.FC = () => {
  const handleClick = () => {
    message.success('按钮被点击');
  };

  return (
    <div className="example-component" style={{ padding: 20 }}>
      <h1>示例组件</h1>
      <Button type="primary" onClick={handleClick}>
        点击
      </Button>
    </div>
  );
};
```

### 文件命名

- 文件名使用 kebab-case
- 组件名使用 PascalCase
- 常量使用 UPPER_SNAKE_CASE
- 变量和函数使用 camelCase

### 目录组织

- 按功能模块组织代码
- 相关文件放在同一目录
- 使用 index.js 作为模块入口
- 工具函数统一放在 utils 目录

## 添加新功能

### 1. 创建核心模块

```ts
// src/main/core/new-feature.ts
import logger from 'electron-log';

export class NewFeature {
  private readonly name = 'NewFeature';

  constructor() {
    logger.info(`${this.name} 初始化`);
  }

  async doSomething(data: unknown): Promise<{ success: boolean; data: string }> {
    try {
      logger.debug('执行操作', data);
      // 实现功能逻辑
      return { success: true, data: '结果' };
    } catch (error) {
      logger.error('操作失败', error);
      throw error;
    }
  }
}
```

### 2. 添加 IPC 处理器

```ts
// src/main/ipc-handlers/new-feature.ts
import { ipcMain } from 'electron';
import { NewFeature } from '../core/new-feature';

let newFeature: NewFeature | null = null;

export function setupNewFeatureIPC(): void {
  newFeature = new NewFeature();

  ipcMain.handle('new-feature-action', async (_event, data) => {
    try {
      const result = await newFeature!.doSomething(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });
}
```

### 3. 注册 IPC 处理器

```ts
// src/main/ipc-handlers/index.ts
import { setupNewFeatureIPC } from './new-feature';

export function setupIpcHandlers(): void {
  // ... 现有处理器
  setupNewFeatureIPC();
}
```

### 4. 更新预加载脚本

```ts
// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ... 现有 API
  newFeature: {
    action: (data: unknown) => ipcRenderer.invoke('new-feature-action', data),
  },
});
```

### 5. 添加前端界面

```tsx
// src/renderer/components/NewFeature.tsx
import React from 'react';
import { Button, message } from 'antd';

export const NewFeature: React.FC = () => {
  const [loading, setLoading] = React.useState(false);

  const handleAction = async () => {
    try {
      setLoading(true);
      // @ts-expect-error 通过 preload 暴露到 window
      const result = await window.electronAPI.newFeature.action({ test: 'data' });
      if (result.success) {
        message.success('操作成功');
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new-feature">
      <Button type="primary" onClick={handleAction} loading={loading}>
        执行操作
      </Button>
    </div>
  );
};
```

## 调试技巧

### 主进程调试

```javascript
// 在代码中添加调试日志
const { logger } = require('./src/utils/logger');

logger.debug('调试信息', { data: 'value' });
logger.info('信息日志');
logger.warn('警告信息');
logger.error('错误信息', error);
```

### 渲染进程调试

```javascript
// 在 React 组件中添加调试
console.log('调试信息', data);
console.warn('警告信息');
console.error('错误信息', error);
```

### 开发者工具

- 主进程：在终端中查看日志
- 渲染进程：使用浏览器开发者工具
- 网络：使用 Network 面板查看请求

## 测试

### 单元测试

```bash
# 运行单元测试
npm run test:unit

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 集成测试

```bash
# 运行集成测试
npm run test:integration
```

### 手动测试

1. 启动应用：`npm run dev`
2. 测试功能流程
3. 检查错误处理
4. 验证用户体验

## 性能优化

### 代码优化

- 避免不必要的计算
- 使用防抖和节流
- 合理使用缓存
- 优化数据结构

### 内存管理

- 及时清理事件监听器
- 避免内存泄漏
- 合理使用闭包

### 网络优化

- 减少不必要的网络请求
- 使用缓存机制
- 优化数据传输

## 错误处理

### 错误分类

1. **用户错误**: 用户输入错误或操作错误
2. **系统错误**: 系统资源不足或权限问题
3. **网络错误**: 网络连接问题
4. **程序错误**: 代码逻辑错误

### 错误处理策略

```javascript
try {
  // 可能出错的操作
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  // 根据错误类型处理
  if (error.code === 'ENOENT') {
    return { success: false, message: '文件不存在' };
  } else if (error.code === 'EACCES') {
    return { success: false, message: '权限不足' };
  } else {
    logger.error('未知错误', error);
    return { success: false, message: '操作失败' };
  }
}
```

## 发布流程

### 1. 代码审查

- 确保代码符合规范
- 检查错误处理
- 验证功能完整性

### 2. 测试

- 运行所有测试
- 手动测试关键功能
- 检查性能表现

### 3. 构建

```bash
# 构建应用
npm run build

# 打包应用
npm run dist
```

### 4. 发布

- 更新版本号
- 生成更新日志
- 发布到仓库

## 常见问题

### Q: 如何调试 IPC 通信？

A: 在主进程和渲染进程都添加日志，查看通信过程。

### Q: 如何处理大文件？

A: 使用流式处理，避免一次性加载到内存。

### Q: 如何优化启动速度？

A: 使用懒加载，延迟加载非关键模块。

### Q: 如何处理跨平台差异？

A: 使用条件判断，针对不同平台实现不同逻辑。

## 资源链接

- [Electron 官方文档](https://www.electronjs
  org/docs)
- [React 官方文档](https://react.dev/learn)
- [Ant Design 5 文档](https://ant.design/components/overview-cn/)
- [Zustand 文档](https://zustand-demo.pmnd.rs/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Node.js 文档](https://nodejs.org/docs/)
