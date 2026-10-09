# 栖伴 Windows 测试版

Windows 10/11 x64 客户端内置共享界面，固定连接 `https://81.70.181.205`。它只允许本地 `app://qiban` 页面进入应用窗口；网页链接在系统浏览器打开。渲染器启用沙箱、上下文隔离，不能访问 Node.js 或读取会话令牌。

## 构建和验证

在仓库根目录安装锁定依赖并生成共享客户端，再在此目录构建：

```sh
npm ci
node scripts/build-clients.mjs
cd clients/windows
npm ci
npm test
npm run smoke
npm run dist
```

`npm run dist` 在 Windows 上生成 `artifacts/windows/Qiban-0.9.0-beta.1-windows-x64-setup.exe` 和便携 ZIP。安装包和 ZIP 都没有商业代码签名；测试用户可能需要通过 Windows 的来源提示确认安装。本项目不内置管理员凭证、不购买证书、也不自动发布 GitHub Release。

测试包默认使用压缩等级 3，减少反复构建等待；可通过 `ELECTRON_BUILDER_COMPRESSION_LEVEL` 覆盖。NSIS 使用 electron-builder 官方校验的 1.2.1 统一工具包，支持在 ARM Mac 上交叉构建。

`.github/workflows/clients.yml` 使用 Windows GitHub 执行器构建，并以独立的临时用户目录启动**已经打包的** EXE，检查内置登录页、原生桥和渲染器隔离。构建结果作为保留 14 天的 Actions Artifact 提供。只有实际成功的运行才能说明 Windows 包已构建和验证；在 macOS 上通过单元测试或开发窗口检查不等同于 Windows 真机验证。

## 账号与本机数据

- 用户名和密码通过系统网络层发给固定服务端，密码不保存。原生令牌由 Electron `safeStorage` 使用系统账号加密后保存，页面仅得到账号 ID、用户名和到期时间。
- 草稿由同一系统加密能力保护，以稳定账号 ID 分开存放。系统加密不可用时拒绝保存，不退回明文。退出账号前由共享界面确认同步状态，退出成功后清理该账号草稿及会话。
- 导出和附件保存使用系统“另存为”对话框。应用不直接写入页面指定的任意路径。Windows 测试版不包含自动更新或后台提醒。
- 普通网络请求限制为 16 MB、本机草稿为 32 MB；草稿中包含兼容的工作区与存储键副本。单次文件保存最多 320 MB，以容纳包含附件的历程导出。
- 不在安装包中包含 AI 配置、服务器代码、私人记录、测试账号或签名密钥。共享构建脚本只复制明确列出的界面资源。

## 检查范围

安全边界测试覆盖固定网络主机、接口与方法白名单、打包资源白名单、路径穿越、外部 URL、文件大小与名称、加密文件替换和令牌不进入页面元数据。安装、真实中文输入、文件选择和系统文件保存仍需 Windows 真机验收；账号密码和 AI 密钥由使用者自行输入。

2026-10-09 已在 ARM Mac 和 GitHub Windows 环境分别构建 NSIS EXE 与便携 ZIP。七项客户端测试通过；[Windows Actions 实际运行](https://github.com/ciki-9876/qiban/actions/runs/37931453026)已验证打包后的 EXE 内置登录页、原生桥、渲染器沙箱及系统加密的真实往返。最终打包资源与冻结源码核对通过。各构建的字节数与 SHA-256 见 `clients/TEST-REPORT.md`；**Windows 安装流程、中文输入与文件对话框仍待人工验收**。
