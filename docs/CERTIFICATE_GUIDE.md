# 证书管理指南

## 📋 概述

NetSniffer 使用自定义的 CA 证书来拦截和解析 HTTPS 流量。本指南详细说明证书的生成、安装和管理流程。

## 📁 证书文件位置

证书文件位于项目根目录的 `certs/` 文件夹中：

```
netsniffer/
└── certs/
    ├── mitmproxy-ca-cert.pem  # CA证书文件
    └── mitmproxy-ca-key.pem   # CA私钥文件
```

## 🔧 证书生成

### 自动生成
应用启动时会自动检查证书文件是否存在：
- 如果证书不存在，会自动生成新的 CA 证书
- 证书生成使用 OpenSSL 工具
- 生成的证书有效期为 10 年

### 手动生成
如果需要手动重新生成证书，可以删除现有证书文件后重启应用：

```bash
# 删除现有证书
rm certs/mitmproxy-ca-cert.pem
rm certs/mitmproxy-ca-key.pem

# 重启应用，会自动生成新证书
pnpm electron-dev
```

## 🚀 自动安装功能

### macOS 自动安装

#### 安装流程
1. 点击"📜 证书状态"按钮
2. 在证书状态对话框中点击"📜 安装证书"
3. 系统会提示输入管理员密码
4. 证书自动安装到系统Keychain

#### 安装位置
- **系统Keychain**: `/Library/Keychains/System.keychain`
- **用户Keychain**: `~/Library/Keychains/login.keychain` (备用方案)

#### 权限要求
- 需要管理员权限 (sudo)
- 如果无法获取管理员权限，会尝试安装到用户Keychain

### Windows 自动安装

#### 安装流程
1. 点击"📜 证书状态"按钮
2. 在证书状态对话框中点击"📜 安装证书"
3. 系统自动安装到受信任根证书颁发机构存储

#### 安装方法
1. **certutil**: 优先使用Windows内置的certutil工具
2. **PowerShell**: 如果certutil失败，使用PowerShell命令
3. **手动安装**: 如果自动安装失败，打开证书文件供手动安装

#### 安装位置
- **受信任根证书颁发机构**: `Cert:\LocalMachine\Root`

## 📖 手动安装指导

### macOS 手动安装

#### 方法1: 使用终端命令
```bash
# 安装到系统Keychain (需要管理员权限)
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "/path/to/mitmproxy-ca-cert.pem"

# 安装到用户Keychain (不需要管理员权限)
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain "/path/to/mitmproxy-ca-cert.pem"
```

#### 方法2: 使用Keychain Access
1. 双击证书文件打开
2. 选择"添加"到Keychain
3. 选择"系统"Keychain
4. 展开证书，双击"信任"
5. 将"使用此证书时"设置为"始终信任"

### Windows 手动安装

#### 方法1: 使用certutil命令
```cmd
# 以管理员身份运行命令提示符
certutil -addstore -f "ROOT" "C:\path\to\mitmproxy-ca-cert.pem"
```

#### 方法2: 使用PowerShell
```powershell
# 以管理员身份运行PowerShell
Import-Certificate -FilePath "C:\path\to\mitmproxy-ca-cert.pem" -CertStoreLocation Cert:\LocalMachine\Root
```

#### 方法3: 使用证书管理器
1. 双击证书文件
2. 选择"安装证书"
3. 选择"本地计算机"
4. 选择"将所有证书放入下列存储"
5. 点击"浏览"，选择"受信任的根证书颁发机构"

## 🔍 验证证书安装

### 1. 通过应用界面验证

#### 步骤1: 打开证书状态对话框
- 点击应用界面上的"📜 证书状态"按钮
- 查看证书状态对话框中的信息

#### 步骤2: 检查关键信息
在证书状态对话框中，你应该看到以下信息：

**✅ 证书存在**: 显示"是"（绿色标签）
**✅ 系统安装**: 显示"已安装"（绿色标签）
**✅ 安装位置**: 显示"System Keychain"（macOS）或"Trusted Root Certification Authorities"（Windows）
**✅ 证书有效性**: 显示"有效"（绿色标签）

### 2. 通过终端命令验证

#### macOS 验证命令

```bash
# 检查系统Keychain中的证书
security find-certificate -c "NetSniffer MITM Proxy CA" /Library/Keychains/System.keychain

# 检查用户Keychain中的证书（备用位置）
security find-certificate -c "NetSniffer MITM Proxy CA" ~/Library/Keychains/login.keychain

# 列出所有受信任的根证书
security list-keychains
security find-certificate -a /Library/Keychains/System.keychain | grep "NetSniffer"
```

#### Windows 验证命令

```cmd
# 检查证书存储
certutil -store "ROOT" "NetSniffer MITM Proxy CA"

# 列出所有根证书
certutil -store "ROOT"

# 使用PowerShell检查
powershell -Command "Get-ChildItem Cert:\LocalMachine\Root | Where-Object {$_.Subject -like '*NetSniffer*'}"
```

### 3. 通过Keychain Access验证（macOS）

1. 打开"钥匙串访问"应用
2. 在左侧选择"系统"钥匙串
3. 在搜索框中输入"NetSniffer"
4. 应该能看到"NetSniffer MITM Proxy CA"证书
5. 双击证书查看详细信息
6. 确认"信任"设置中"使用此证书时"显示"始终信任"

### 4. 通过证书管理器验证（Windows）

1. 按 `Win + R`，输入 `certmgr.msc`
2. 展开"受信任的根证书颁发机构" → "证书"
3. 在右侧列表中查找"NetSniffer MITM Proxy CA"
4. 双击证书查看详细信息

### 5. 通过浏览器验证

#### 测试HTTPS抓包
1. 启动抓包服务
2. 设置系统代理为 `127.0.0.1:7890`
3. 访问任意HTTPS网站（如 https://www.google.com）
4. 检查应用中的数据表格是否显示HTTPS请求
5. 如果能看到HTTPS请求且没有证书错误，说明证书安装成功

#### 检查浏览器证书存储
- **Chrome**: 设置 → 隐私设置和安全性 → 安全 → 管理证书
- **Firefox**: 设置 → 隐私与安全 → 查看证书
- **Safari**: 偏好设置 → 隐私 → 管理网站数据 → 证书

## 🛠️ 常见问题排查

### 问题1: 应用显示"证书安装成功"但实际未安装

**可能原因:**
- 应用使用了模拟API而不是真实IPC通信
- 权限不足，安装失败但返回了成功消息
- 证书文件不存在或损坏

**解决方案:**
1. 检查应用是否使用了预加载脚本
2. 查看应用控制台是否有错误信息
3. 手动运行安装命令验证

### 问题2: 证书安装后仍无法抓取HTTPS流量

**可能原因:**
- 浏览器缓存问题
- 系统代理设置不正确
- 某些应用不信任用户安装的证书

**解决方案:**
1. 重启浏览器
2. 清除浏览器缓存和Cookie
3. 确认系统代理设置正确
4. 检查防火墙设置

### 问题3: 证书安装时提示权限不足

**macOS解决方案:**
1. 确保使用管理员账户
2. 在系统偏好设置中允许终端访问辅助功能
3. 尝试安装到用户Keychain而不是系统Keychain

**Windows解决方案:**
1. 以管理员身份运行应用
2. 在UAC提示时选择"是"
3. 确保用户有管理员权限

### 问题4: 证书显示"无效"或"已过期"

**解决方案:**
1. 删除旧证书
2. 重新生成证书
3. 重新安装证书
4. 检查系统时间是否正确

## 📝 注意事项

1. **安全性**: 安装的CA证书具有解密HTTPS流量的能力，请妥善保管
2. **权限**: 安装到系统存储需要管理员权限
3. **兼容性**: 某些应用可能不信任用户安装的证书
4. **更新**: 证书过期后需要重新安装
5. **备份**: 建议备份证书文件以便重新安装

## 🔗 相关链接

- [项目主页](../README.md)
- [使用说明](../使用说明.md)
- [故障排除](../docs/TROUBLESHOOTING.md) 