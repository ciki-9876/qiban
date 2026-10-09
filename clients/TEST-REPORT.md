# v0.9.0-beta.1 验证记录

日期：2026-10-09。测试使用独立临时数据，没有读取真实账号密码、AI 密钥、凭证文件或私人记录。

## 代码与安全验证

- 完整测试 163 项全部通过，原有 105 项保留。覆盖原业务、目标创建与归档、原生会话隔离 / 撤销 / 过期、账号缓存隔离、离线重启草稿、修订冲突、表单恢复、取消导出和上传期间继续编辑。
- 账号切换检查覆盖旧页面立即锁定、响应身份绑定、外部 Cookie 变化后禁止解析其他账号的私人响应，以及旧原生请求 / 退出不得影响新登录。密码、AI 密钥和令牌不进入工作区缓存。
- Web 下载与系统文件分享保留独立入口；分享按钮重新取得用户手势。取消分享不丢失草稿。Service Worker 仅缓存公开应用外壳，不缓存私人 API 响应。
- Pages 2 项通过；单文件原型、Pages 及共享客户端重新生成。Capacitor Android / iOS 同步、Swift 语法、Xcode 工程 / plist、JavaScript 语法和差异格式检查通过。
- 后续只修改 iOS CI 首次安装 / 启动等待及失败诊断；该驱动的 8 项针对性测试通过，未改业务代码。
- 241 个源码及生成客户端文本文件完成扫描，未发现真实密钥、私人记录、会话令牌或本机私有路径。客户端构建仅包含公开资源白名单，不包含服务器代码、AI 配置或私人数据。

## 实际构建与运行

[客户端构建 37940000797](https://github.com/ciki-9876/qiban/actions/runs/37940000797) 使用业务源码 `ae0dccb16b3ada7367f32c0c953b99f52bd2b1b6`，Windows 与 Android 均成功。下面的本机交付包来自这次运行，Actions 归档摘要核对成功后才解压。

之后提交 `c60c8bf3ff0f520085fc64e3bbee3924363dfa53` 只调整 iOS 验证驱动；[客户端构建 37942115422](https://github.com/ciki-9876/qiban/actions/runs/37942115422) 再次通过完整 163 项、Pages 2 项、Windows 打包启动和 Android 模拟器检查，业务代码与下面的交付包相同。

| 产物 | 字节数 | SHA-256 |
| --- | ---: | --- |
| Android `app-debug.apk` | 12445556 | `39ecd25e912382ff98b4156f2ef6b90c94687d6a65ed370625aae9732ce0d34d` |
| Windows `Qiban-0.9.0-beta.1-windows-x64-setup.exe` | 132232902 | `90d04b634ee3dba8c415f6f50a7c7c3a98f7e2d5d6d0ca815d203ef00bb1a707` |
| Windows `Qiban-0.9.0-beta.1-windows-x64.zip` | 164608614 | `e6fdf5df9a7abc6f8441db0f1d824802eaa3c9a1cdf1370365812d39feed49ff` |

本机目录：`artifacts/android-ci-ae0dccb`、`artifacts/windows-ci-ae0dccb`。安装包未使用商业代码签名；安卓包使用测试签名。

- **Android：**全新隔离 AOSP API 36 x86_64 模拟器的仪表检查为 `OK (1 test)`，验证内置中文登录表单、原生桥和独立加密 fixture 写 / 读 / 删。登录截图已人工复核。报告位于 `artifacts/android-smoke-ae0dccb/artifacts/android-smoke/`；未使用真实凭证，也未自动接受新许可。
- **Windows：**在 GitHub Windows 执行器启动已经打包的 EXE，验证内置登录页、渲染器沙箱、原生桥和 Windows 系统加密的真实往返。macOS 上也使用隔离临时用户目录验证 Electron 启动和系统加密。
- **iOS：**[37942115617](https://github.com/ciki-9876/qiban/actions/runs/37942115617) 已编译、完成 Simulator 专用 ad-hoc 签名并安装成功；首次启动超过 60 秒限时，截图仍为主屏，尚未验证登录页或 Keychain。已提高首次启动限时并增加仅针对全新 GitHub 模拟器的有界诊断及耗时报告，等待后续运行。模拟器签名不能用于 iPhone。
- **Web：**隔离云服务与浏览器验证中文输入、创建目标、归档和表单草稿恢复。390 × 844 尺寸检查输入字号 16 px、主要按钮 44 px、对话框宽 358 px；修复对话框横向裁切。另以隔离浏览器检查顶部安全区域 0 / 62 px 布局，这不是手机真机验证。

## 服务器

腾讯云已隔离验证较早候选 `9c397a7993b56c05da6610100dbf03e074a82ab3`：云端测试、真实 HTTP 双账号 / 会话 / 工作区 / 附件 / AI 配置隔离及 Caddy 配置通过，没有访问生产数据。

包含账号切换保护的新业务源码 `ae0dccb16b3ada7367f32c0c953b99f52bd2b1b6` 已准备暂存、备份切换与回滚脚本，尚未执行。生产 HTTPS 健康检查仍报告 **v0.8.0 multiuser**；因此已生成的安装应用仍需等服务器升级后才能使用新增 `/api/native/` 登录。旧版本回滚目录与私人备份在切换完成前不能报告已交付。

## 尚未完成的实测

- 本机兼容的 Xcode 26.6 已安装并通过 Apple 代码签名和 Gatekeeper 核验。首次协议 / 组件配置、Apple ID 免费签名及连接、信任 iPhone 由用户本人完成；本机模拟器和 iPhone 尚未验证。
- Android Studio、SDK 命令行工具及 JDK 21 已从官方来源安装。安装器 2019 基础许可不同于已确认的下载页条款，待用户确认后才能继续本机 SDK / 模拟器安装。云端 APK 和模拟器验证已完成，使用 APK 不依赖本机开发环境安装。
- Windows 安装流程、真实中文输入、另存为对话框尚未人工验收。
- 真实账号和 AI、手机键盘遮挡、系统文件选择 / 分享、横屏、后台切换及进程关闭后的完整业务恢复尚未在真实设备验收。程序测试和匿名启动检查不能代替这些验证。
- 服务器最新隔离验证及生产备份切换，等待切换确认与本机解锁；上线状态以实际服务器健康检查为准。

## 发布权限

本机 Git 推送实际返回 HTTP 403：`Permission to ciki-9876/qiban.git denied to ciki-9876`。已使用用户授权的 GitHub 连接器普通更新 main，使用 `force: false` 并核对旧分支 SHA。iOS 驱动修复提交为 `c60c8bf3ff0f520085fc64e3bbee3924363dfa53`；远端文件树与本机对应提交完全相等，未强制推送。安装包业务代码与该提交相同，差别仅为 CI 验证驱动。
