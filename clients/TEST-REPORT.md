# v0.9.0-beta.1 验证记录

日期：2026-10-09。测试使用独立临时数据，没有读取真实账号密码、AI 密钥、凭证文件或私人记录。

## 代码与安全验证

- 完整测试 173 项全部通过，原有 105 项保留。覆盖原业务、目标创建与归档、原生会话隔离 / 撤销 / 过期、账号缓存隔离、离线重启草稿、修订冲突、表单恢复、取消导出和上传期间继续编辑。
- 账号切换检查覆盖旧页面立即锁定、响应身份绑定、外部 Cookie 变化后禁止解析其他账号的私人响应，以及旧原生请求 / 退出不得影响新登录。密码、AI 密钥和令牌不进入工作区缓存。
- Web 下载与系统文件分享保留独立入口；分享按钮重新取得用户手势。取消分享不丢失草稿。Service Worker 仅缓存公开应用外壳，不缓存私人 API 响应。
- Pages 2 项通过；单文件原型、Pages 及共享客户端重新生成。Capacitor Android / iOS 同步、Swift 语法、Xcode 工程 / plist、JavaScript 语法和差异格式检查通过。
- Windows 增加会话过期后最后一份本机草稿的加密保存保护；回归验证网络仍拒绝过期会话、重启及同账号重新登录可恢复草稿、其他账号和退出后不能写入。
- 手机端相同边界完成源码复核：到期仅拒绝网络请求，仍保留本机会话用于同账号最后一次加密保存；共享锁屏流程先保存快照再自动进入登录。此项尚未在真实手机验证。
- 后续修复 iOS 模拟器包两个动态库的签名，并调整 CI 首次安装 / 启动等待及失败诊断；15 项针对性测试通过，未改 iOS 业务代码。在 CI 包副本上实际重签，两个架构的动态库与整个包均通过签名核验，但不能代替启动验证。单次能力声明对照仅用于诊断，保留原始结果，独立副本的成功不能代替原工程验证。
- 241 个源码及生成客户端文本文件完成扫描，后续 4 个 iOS 对照相关文件另做检查，未发现真实密钥、私人记录、会话令牌或本机私有路径。客户端构建仅包含公开资源白名单，不包含服务器代码、AI 配置或私人数据。

## 实际构建与运行

[客户端构建 37940000797](https://github.com/ciki-9876/qiban/actions/runs/37940000797) 使用业务源码 `ae0dccb16b3ada7367f32c0c953b99f52bd2b1b6`，Windows 与 Android 均成功。下面的 Android APK 来自这次运行；Windows 使用之后包含过期草稿保护的包。Actions 归档摘要核对成功后才安全解压。

提交 `50bababf4b508d40d94bd8455a212fb1ee1a497e` 的 [客户端构建 38021617292](https://github.com/ciki-9876/qiban/actions/runs/38021617292) 完整测试 169 项、Pages 2 项已通过；新版 Windows 包及已打包程序启动检查成功，包含过期草稿保护；Android 业务源码与下面的交付 APK 相同。

提交 `1c708c7524ddb516ec70c01a6bb9923141e73d70` 的 [客户端构建 38023180061](https://github.com/ciki-9876/qiban/actions/runs/38023180061) 已全部成功：完整 173 项测试、Pages 2 项、手机驱动 22 项、Windows 12 项，Android 构建 / 模拟器及 Windows 打包 / 已打包程序启动检查均通过。本次增加的是隔离 iOS 对照及其守卫测试，交付 Android / Windows 的业务源码未变。

| 产物 | 字节数 | SHA-256 |
| --- | ---: | --- |
| Android `app-debug.apk` | 12445556 | `39ecd25e912382ff98b4156f2ef6b90c94687d6a65ed370625aae9732ce0d34d` |
| Windows `Qiban-0.9.0-beta.1-windows-x64-setup.exe` | 132232978 | `d1aae61da595cb4954a642053dac0b389c3b7a55fe7f67207366e02bcda74ee5` |
| Windows `Qiban-0.9.0-beta.1-windows-x64.zip` | 164608685 | `a2ebd04b6beb348d18b1a3cc93bafb5c449180ea00100c2404bfb6f5c9582720` |

本机目录：`artifacts/android-ci-ae0dccb`、`artifacts/windows-ci-50babab`。安装包未使用商业代码签名；安卓包使用测试签名。

- **Android：**全新隔离 AOSP API 36 x86_64 模拟器的仪表检查为 `OK (1 test)`，验证内置中文登录表单、原生桥和独立加密 fixture 写 / 读 / 删。登录截图已人工复核。报告位于 `artifacts/android-smoke-ae0dccb/artifacts/android-smoke/`；未使用真实凭证，也未自动接受新许可。
- **Windows：**在 GitHub Windows 执行器启动同次构建的 `win-unpacked` EXE，验证内置登录页、渲染器沙箱、原生桥和 Windows 系统加密的真实往返；Windows 单元测试 12 / 12。下载完整归档、CRC 与最终两件文件摘要核对通过；便携包公开 UI 24 项精确匹配白名单，ASAR 的三份业务源码与仓库一致（规范化 Windows 检出换行），未包含服务器及私人数据。未执行 NSIS 安装 / 卸载向导。macOS 上先前使用隔离临时用户目录验证 Electron 启动和系统加密。
- **iOS：**[最后一轮 38023180059](https://github.com/ciki-9876/qiban/actions/runs/38023180059) 已编译、模拟器签名并安装。原包 A 与仅删除旧 `armv7` 声明的副本 B 均在应用启动阶段失败，未取得匿名登录、Keychain 和加密草稿 readiness；对照成功执行不能算应用通过。已安装原包的签名核验通过，可执行权限 755，两架构均为 Simulator 平台 7、最低系统 16、SDK 26.5，未取得符合自身路径及时间守卫的崩溃元信息，根因仍未确定。先前 [38021167134](https://github.com/ciki-9876/qiban/actions/runs/38021167134) 的完整启动错误为 `FBSOpenApplicationServiceErrorDomain code=1`、SpringBoard 拒绝；其诊断命令超时也不能证明系统没有错误。工程、原包与对照证据保留，iPhone 尚未安装；模拟器签名不能用于 iPhone。
- **Web：**隔离云服务与浏览器验证中文输入、创建目标、归档和表单草稿恢复。390 × 844 尺寸检查输入字号 16 px、主要按钮 44 px、对话框宽 358 px；修复对话框横向裁切。另以隔离浏览器检查顶部安全区域 0 / 62 px 布局，这不是手机真机验证。

最新 iOS 实际证据保存在 `artifacts/ios-ci-1c708c7`。A 的模拟器启动 / 安装 / 应用启动分别约 196 / 40 / 1.3 秒，B 约 63 / 33 / 2.6 秒；两份截图均为主屏及已安装图标。两份完整启动 stderr 同为 `FBSOpenApplicationServiceErrorDomain 1`、`SBMainWorkspace` 拒绝。此轮自身日志还记录 SplashBoard code 6 / bad launch image / denylist，以及 `RBSRequestErrorDomain 5` 下的 `NSPOSIXErrorDomain 162`、`Launchd job spawn failed`；这些记录未给出可确认的代码或信任根因。没有根据该结果修改业务权限或将 B 当作交付应用。17 文件归档已与 GitHub 摘要一致：17,686,447 字节，SHA-256 `d266776f5260d751cfaff1f2d51e33ad2196a6e0ce9fa2d8c8324f1fca6315fd`。

后续 Android 源码增加专属 OkHttp 5.5.0 原生连接，明确不读写 Capacitor 的全局 Cookie，保持默认 TLS、固定 HTTPS 服务、账号保护和请求 / 响应大小限制。独立 JDK 21 合成 HTTP 回归 1 项通过，实际验证全局 CookieHandler 读取 / 写入均为零、远端 Set-Cookie 不保存、302 不跟随、503 不自动重试；7 项既有相关 Node 检查通过。此改动尚未包含在上表已安装的旧 APK 中，现有包已由用户确认可以注册登录，无需立即更换。Gradle 单元测试和新包编译、设备运行由后续 CI 验证；大小限制此轮仅源码复核，未做动态边界测试。第三方许可保留在 APK assets。

## 服务器

腾讯云已隔离验证业务源码 `ae0dccb16b3ada7367f32c0c953b99f52bd2b1b6`，候选目录 `/opt/qiban/releases/v0.9.0-beta.1-ae0dccb16b3a`。云端 13 项测试、真实 HTTP 双账号、Web / 原生会话边界、工作区修订冲突、附件与 AI 配置隔离、响应账号绑定及 Caddy 配置均通过。测试使用随机凭证与临时目录，禁止外部 AI 请求，隔离服务不可访问生产数据目录。

上线前暂存状态：`/opt/qiban/deploy-staging/stage-v090.rm05Z3wg/status.txt` 报告 `VALIDATED`，工作单元成功退出。后续提交只更改客户端驱动、Windows 草稿保护及文档，服务端运行资源与此候选相同。

用户确认后，服务器已完成一致性备份及代码切换，生产 HTTPS 健康检查报告 **v0.9.0-beta.1 multiuser / apiVersion 1**。当前发布目录为上述 ae 候选；旧版本发布目录保留，回滚脚本已准备。备份只在服务器保存，目录权限 root:0700、归档 root:0600，摘要核验通过，没有查看或下载私人记录。

上线状态 `/opt/qiban/deploy-staging/switch-v090.QRNTBa72/status.txt` 为 `LIVE`，工作单元 `qiban-switch-v090-ae0dccb16b3a-1791607478` 成功退出，栖伴服务保持 active。私人备份路径 `/var/backups/qiban/v080-before-v090-ae0dccb16b3a-20261010T044438Z`；外层截图 `publication/v090-live-verified.png` 保存状态及权限核验结果。

公网边界复核：原生注册 / 登录使用空输入返回 400 输入校验，已越过旧版 Web 来源检查；原生请求带 Origin 或合成 Cookie 返回 403，匿名原生账号请求返回 401；Web 注册无 Origin 仍返回 403 来源错误，正确同源空输入返回 400。PWA manifest、Service Worker 与应用图标均可访问。没有创建生产测试账号或使用用户截图中的凭证。原安卓包 `/api/native/auth/register` 与现服务兼容，用户本人重试后已确认注册并登录成功。

## 尚未完成的实测

- 本机兼容的 Xcode 26.6 已安装并通过 Apple 代码签名和 Gatekeeper 核验。用户已亲自同意首次协议，首次组件检查已通过；iOS 26.5 模拟器支持正在按官方界面下载，本机隔离工程开始构建。Apple ID 免费签名及连接、信任 iPhone 由用户本人完成，用户表示稍后处理；本机模拟器和 iPhone 尚未验证。
- Android Studio、SDK 命令行工具及 JDK 21 已从官方来源安装。安装器 2019 基础许可不同于已确认的下载页条款，待用户确认后才能继续本机 SDK / 模拟器安装。云端 APK 和模拟器验证已完成，使用 APK 不依赖本机开发环境安装。
- Windows 安装流程、真实中文输入、另存为对话框尚未人工验收。
- 真实账号和 AI、手机键盘遮挡、系统文件选择 / 分享、横屏、后台切换及进程关闭后的完整业务恢复尚未在真实设备验收。程序测试和匿名启动检查不能代替这些验证。
- 服务器最新隔离验证、生产一致性备份、代码切换和公网接口边界检查均已通过。上线状态以实际服务器健康检查为准。

## 发布权限

本机 Git 推送实际返回 HTTP 403：`Permission to ciki-9876/qiban.git denied to ciki-9876`。已使用用户授权的 GitHub 连接器普通更新 main，使用 `force: false` 并核对旧分支 SHA。功能代码与后续隔离 iOS 对照均已发布；远端文件树与本机对应提交完全相等，未强制推送。各平台交付包的来源提交与实际验证范围见上文。
