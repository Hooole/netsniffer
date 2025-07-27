# 故障排除指南

## 常见问题及解决方案

### 1. 应用启动问题

#### 问题：应用无法启动
**症状：** 双击应用图标或运行 `npm start` 后应用无响应

**可能原因：**
- Node.js 版本不兼容
- 依赖包安装不完整
- 权限问题

**解决方案：**
```bash
# 1. 检查 Node.js 版本
node --version  # 应该是 16.0.0 或更高

# 2. 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 3. 清除缓存
npm cache clean --force

# 4. 重新安装 Electron
npm run postinstall
```

#### 问题：Electron 安装失败
**症状：** `npm install` 时 Electron 下载失败

**解决方案：**
```bash
# 1. 设置镜像源
npm config set ELECTRON_MIRROR https://npmmirror.com/mirrors/electron/

# 2. 手动下载 Electron
cd node_modules/electron
node install.js
```

### 2. 证书相关问题

#### 问题：证书安装失败
**症状：** 点击"安装证书"后一直 loading 或提示失败

**可能原因：**
- 权限不足
- 证书文件损坏
- 系统安全策略限制

**解决方案：**

**macOS:**
```bash
# 1. 手动安装证书
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/mitmproxy-ca-cert.pem

# 2. 检查证书状态
security find-certificate -c "RPA-AI MITM Proxy CA" /Library/Keychains/System.keychain
```

**Windows:**
```cmd
# 1. 以管理员身份运行命令提示符
# 2. 安装证书
certutil -addstore -f "ROOT" certs\mitmproxy-ca-cert.pem

# 3. 检查证书状态
certutil -store "ROOT" "RPA-AI MITM Proxy CA"
```

#### 问题：证书状态显示不一致
**症状：** 主界面显示未安装，弹框显示已安装

**解决方案：**
1. 重启应用
2. 点击"📜 证书状态"刷新状态
3. 检查系统证书存储

### 3. 代理设置问题

#### 问题：代理设置失败
**症状：** 系统代理显示未设置或设置失败

**可能原因：**
- 网络服务未找到
- 权限不足
- 防火墙阻止

**解决方案：**

**macOS:**
```bash
# 1. 查看网络服务
networksetup -listallnetworkservices

# 2. 手动设置代理
networksetup -setwebproxy "Wi-Fi" 127.0.0.1 7788
networksetup -setsecurewebproxy "Wi-Fi" 127.0.0.1 7788
networksetup -setwebproxystate "Wi-Fi" on
networksetup -setsecurewebproxystate "Wi-Fi" on
```

**Windows:**
```cmd
# 1. 以管理员身份运行 PowerShell
# 2. 设置代理
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyEnable -Value 1
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyServer -Value '127.0.0.1:7788'
```

#### 问题：代理设置后无法访问网络
**症状：** 设置代理后浏览器显示"无法连接"或"网页暂时无法访问"

**可能原因：**
- 代理服务器未启动
- 端口被占用
- 防火墙阻止

**解决方案：**
1. 确保点击了"▶️ 开始抓包"按钮
2. 检查端口 7788 是否被占用：
   ```bash
   # macOS/Linux
   lsof -i :7788
   
   # Windows
   netstat -an | findstr 7788
   ```
3. 临时关闭防火墙测试
4. 尝试使用其他端口

### 4. 抓包数据问题

#### 问题：抓包数据为空
**症状：** 抓包数量显示为 0，没有捕获到任何请求

**可能原因：**
- 代理未正确设置
- 流量未经过代理
- 应用未访问网络

**解决方案：**
1. 确认代理已设置：
   - 检查系统代理设置
   - 确认代理地址为 `127.0.0.1:7788`
2. 测试网络访问：
   - 访问 HTTP 网站（如 http://httpbin.org）
   - 检查是否有网络活动
3. 重启浏览器
4. 清除浏览器缓存

#### 问题：HTTPS 抓包失败
**症状：** 只能抓取 HTTP 请求，HTTPS 请求无法解密

**可能原因：**
- 证书未正确安装
- 浏览器不信任证书
- 证书过期

**解决方案：**
1. 重新安装证书
2. 重启浏览器
3. 检查证书有效期
4. 清除浏览器证书缓存

### 5. 数据导出问题

#### 问题：数据导出失败
**症状：** 点击导出按钮后无响应或提示失败

**可能原因：**
- 文件权限不足
- 磁盘空间不足
- 文件路径无效

**解决方案：**
1. 选择有写入权限的目录
2. 检查磁盘空间
3. 避免使用特殊字符的文件名
4. 尝试导出到桌面

### 6. 性能问题

#### 问题：应用运行缓慢
**症状：** 界面响应慢，抓包数据更新延迟

**可能原因：**
- 内存不足
- CPU 使用率过高
- 大量网络请求

**解决方案：**
1. 关闭不必要的应用
2. 减少抓包数据量
3. 定期清理抓包数据
4. 重启应用

#### 问题：内存占用过高
**症状：** 应用内存使用量持续增长

**可能原因：**
- 抓包数据未清理
- 内存泄漏
- 大量请求数据

**解决方案：**
1. 定期点击"🗑️ 清空数据"
2. 重启应用
3. 限制抓包数据量

### 7. 跨平台问题

#### macOS 特定问题

**问题：** 应用无法访问网络
**解决方案：**
1. 系统偏好设置 → 安全性与隐私 → 网络
2. 允许应用访问网络

**问题：** 证书安装需要管理员权限
**解决方案：**
1. 使用 `sudo` 运行应用
2. 或手动安装证书到用户 keychain

#### Windows 特定问题

**问题：** 应用被杀毒软件误报
**解决方案：**
1. 添加应用到杀毒软件白名单
2. 或临时关闭实时保护

**问题：** 代理设置不生效
**解决方案：**
1. 以管理员身份运行应用
2. 检查 Windows Defender 防火墙设置

### 8. 开发环境问题

#### 问题：开发模式无法启动
**症状：** `npm run dev` 失败

**解决方案：**
```bash
# 1. 检查依赖
npm install

# 2. 清除缓存
npm cache clean --force

# 3. 重新安装
rm -rf node_modules package-lock.json
npm install
```

#### 问题：热重载不工作
**症状：** 修改代码后应用不自动重启

**解决方案：**
1. 确保使用 `npm run dev` 启动
2. 检查文件保存
3. 手动重启应用

### 9. 日志和调试

#### 查看应用日志

**主进程日志：**
- 在终端中查看启动时的输出
- 或添加 `console.log` 到主进程代码

**渲染进程日志：**
- 开发者工具 → Console 面板
- 或添加 `console.log` 到前端代码

#### 启用详细日志

```bash
# 启动时启用详细日志
npm run dev:debug

# 或在代码中添加日志
const { logger } = require('./src/utils/logger');
logger.debug('调试信息', data);
```

### 10. 获取帮助

如果以上解决方案都无法解决问题，请：

1. **收集信息：**
   - 操作系统版本
   - Node.js 版本
   - 应用版本
   - 错误信息
   - 操作步骤

2. **提交问题：**
   - 在 GitHub Issues 中提交问题
   - 提供详细的错误描述
   - 附上日志信息

3. **联系支持：**
   - 发送邮件到 team@rpa-ai.com
   - 或在 GitHub Discussions 中讨论

## 预防措施

### 定期维护
1. 定期更新应用版本
2. 清理抓包数据
3. 检查证书有效期
4. 更新系统补丁

### 最佳实践
1. 使用管理员权限运行
2. 定期备份重要数据
3. 避免在公共网络使用
4. 及时报告问题

### 安全建议
1. 仅用于合法目的
2. 保护抓包数据安全
3. 及时删除敏感信息
4. 遵守相关法律法规 