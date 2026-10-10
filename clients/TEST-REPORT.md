# v0.9.0-beta.1 验证记录

日期：2026-10-09。测试使用独立临时数据，没有读取真实账号密码、AI 密钥、凭证文件或私人记录。

## 代码与安全验证

- 本机完整测试 176 项全部通过，原有 105 项保留。覆盖原业务、目标创建与归档、原生会话隔离 / 撤销 / 过期、账号缓存隔离、离线重启草稿、修订冲突、表单恢复、取消导出和上传期间继续编辑。
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
- **iOS：**本机 Xcode 26.6 / iOS 26.5 新建 iPhone 17 模拟器已成功构建、安装并启动，匿名登录页、独立 Keychain 写 / 读 / 删及 AES 加密草稿文件写 / 读均通过；截图已人工查看。使用正常 Xcode Simulator ad-hoc 签名，整个应用通过严格签名核验，没有覆盖业务权限、使用 Apple 开发身份或读取真实钥匙串。随后 GitHub 原工程构建与同样的三项启动检查也通过，见下文；这些检查不能代替账号业务和 iPhone 验证。
- **Web：**隔离云服务与浏览器验证中文输入、创建目标、归档和表单草稿恢复。390 × 844 尺寸检查输入字号 16 px、主要按钮 44 px、对话框宽 358 px；修复对话框横向裁切。另以隔离浏览器检查顶部安全区域 0 / 62 px 布局，这不是手机真机验证。

本机 iOS 证据保存在 `artifacts/ios-local-v090`。正常远程 SPM 在检出 Capacitor 8.5.3 后停滞约 10 分 26 秒；仅在隔离工程副本中改用从官方发布下载、与 Package.swift 固定 SHA 完全一致的 Capacitor / Cordova XCFramework。四份原生 Swift 源码与源工程逐字节一致，仓库依赖声明未改；此结果不能算远程 SPM 流程通过。新建模拟器启动约 55 秒、安装约 14.8 秒、应用启动约 28.5 秒；402 × 778 CSS 视口的账号 / 密码输入框高 48 px、登录按钮高 46 px，均完整可见。测试模拟器已关闭。

本机 `Qiban-v090-local-Simulator.zip` 为 5,731,450 字节，SHA-256 `c4c69194c3d0d11d74c98fd40d98fbe8f6f04d8096a10c2324507d0a9ca7aba7`，仅能用于 Simulator，不能安装到 iPhone。结果、就绪回执、截图、依赖摘要与签名元信息均保留在上述目录。

交付的 `Qiban-v090-clean-Simulator.zip` 移除了 63 个 macOS 打包元信息成员，保留成员的内容与权限不变；原始归档保留。新包为 5,712,832 字节，SHA-256 `ecd3d2a221e3ec769a63c110f6eb9cc1f792ec066a64812eae60fe2263e74f0d`，CRC、解压后的严格签名核验均通过。25 个界面资源与清单逐字匹配本机生成资源，四份 Swift 源码另与上述 `6d80e5e` 提交的 Git blob 匹配；这不代表完整工程与远端同树或远程 SPM 可重复构建。证据为 `package-clean.json`、`source-binding.json` 和 `clean-signing-verified.json`。

持续构建已改用本机成功的 Xcode Simulator ad-hoc 方式，之后只做平台、固定应用 ID、无配置描述文件及严格签名核验；默认流程不再手工重签或运行能力副本对照。

提交 `cab5bce5a2362c46e53fbdca940b0d8266bb7a80` 的 [iOS 构建 38028413981](https://github.com/ciki-9876/qiban/actions/runs/38028413981) **全部通过**：原工程正常依赖解析、构建、Xcode 模拟器签名、安装、启动、匿名表单、Keychain 写 / 读 / 删和加密草稿写 / 读。就绪回执晚于实际启动，截图已人工复核；启动后进程检查通过，测试结束关闭模拟器。模拟器 bootstatus 约 310 秒，安装约 66 秒，应用启动约 6 秒，没有根据本次成功追认旧失败的根因。

最终云端交付包 `artifacts/ios-ci-cab5bce/Qiban-0.9.0-beta.1-ios-simulator.zip` 为 **5,714,105 字节**，SHA-256 **`83b1f25cbc34a20920e6528f785192c1908ffc98b6dd9ef8d909accdf07e0b50`**。完整 Actions 归档为 5,883,029 字节，SHA-256 `f40eb63a6572e19d60e2adc894da32cc2d64e58335d65e1887b1e86dea0ee2f5`，与 GitHub 摘要匹配；归档 CRC、路径白名单、解压后的严格签名核验均通过。界面含 25 个资源及清单，另有 Capacitor 同步生成的两个空 Cordova 文件，未包含账号配置或服务器数据。仅可用于 Simulator，不能安装到 iPhone。

同一提交的 [客户端构建 38028414076](https://github.com/ciki-9876/qiban/actions/runs/38028414076) 也全部通过：176 项完整测试、Pages 2 项、Windows 构建 / 已打包程序启动，以及 Android 构建 / HTTP 单元回归 / AOSP 模拟器检查。Android、Windows 业务代码没有再次变动，交付文件继续使用上文已核验的包。

新的只读签名核验器 3 项守卫测试通过，拒绝真机产品、配置描述文件、其他应用 ID、证书 / 团队签名及严格核验失败；已对本机真实构建 App.app 执行核验，结果通过，记录在 `xcode-verified-signing.json`。本轮 6 个源码 / 文档文件的差异格式及高置信密钥模式检查通过。

本机另完成匿名界面观察：软件键盘可输入，合成中文粘贴正确显示；聚焦密码后自动滚动，两输入框及登录按钮在键盘上方可见。Home 切后台后点击自身图标返回，匿名页面及当前合成输入保留。返回时若密码仍聚焦，登录按钮部分位于键盘附件栏下；滑动正文收起键盘后可见，保持键盘展开的手动滚动未独立确认。未测试完整中文输入法组合、账号业务或进程关闭后的草稿恢复；没有提交登录 / 注册。记录及五张截图在 `artifacts/ios-local-v090/ui-anonymous`，自身模拟器已关闭。

GitHub [38023180059](https://github.com/ciki-9876/qiban/actions/runs/38023180059) 已编译、模拟器签名并安装，原包 A 与仅删除旧 `armv7` 声明的副本 B 均在启动阶段失败，没有就绪回执；对照步骤执行成功不代表应用通过。[38026846551](https://github.com/ciki-9876/qiban/actions/runs/38026846551) 也在安装 / 启动步骤失败。已下载的 A/B 证据保存在 `artifacts/ios-ci-1c708c7`：A 的模拟器启动 / 安装 / 应用启动分别约 196 / 40 / 1.3 秒，B 约 63 / 33 / 2.6 秒；两份截图均为主屏及已安装图标。完整启动 stderr 同为 `FBSOpenApplicationServiceErrorDomain 1`、`SBMainWorkspace` 拒绝；自身日志记录 SplashBoard code 6 / bad launch image / denylist，以及 `RBSRequestErrorDomain 5` 下的 `NSPOSIXErrorDomain 162`、`Launchd job spawn failed`。原包签名核验通过、可执行权限 755，两架构均为 Simulator 平台 7、最低系统 16、SDK 26.5，没有符合自身路径及时间守卫的崩溃元信息。托管环境失败根因仍未确定，本机成功不能证明根因。17 文件归档摘要核对一致：17,686,447 字节，SHA-256 `d266776f5260d751cfaff1f2d51e33ad2196a6e0ce9fa2d8c8324f1fca6315fd`；没有根据此结果删除业务权限或将 B 当作交付应用。

后续 Android 源码增加专属 OkHttp 5.4.0 原生连接，明确不读写 Capacitor 的全局 Cookie，保持默认 TLS、固定 HTTPS 服务、账号保护和请求 / 响应大小限制。该版本的官方 AAR 要求 compile SDK 36，与现有 SDK / AGP 兼容。独立 JDK 21 合成 HTTP 回归 1 项通过，实际验证全局 CookieHandler 读取 / 写入均为零、远端 Set-Cookie 不保存、302 不跟随、503 不自动重试；7 项既有相关 Node 检查通过。此改动尚未包含在上表已安装的旧 APK 中，现有包已由用户确认可以注册登录，无需立即更换。Gradle 单元测试和新包编译、运行验证详见下段；大小限制此轮仅源码复核，未做动态边界测试。第三方许可保留在 APK assets。

上述新增连接已由提交 `6d80e5ec2f48a3d14bee5aa84a0a678bdb4f2dd6` 的 [客户端构建 38026846539](https://github.com/ciki-9876/qiban/actions/runs/38026846539) 验证通过：完整 173 项及 Pages 2 项、Android assembleDebug / testDebugUnitTest / AOSP 模拟器匿名界面与加密 fixture、Windows 构建及已打包程序启动检查均成功。新 APK 保存在 `artifacts/android-ci-6d80e5e/app-debug.apk`，13,914,829 字节，SHA-256 `4317a2cd13fc1d4c261b89fe373efacd44bc500e54f3ebe75e1566ca4a6fde4f`；单文件 Actions 归档摘要、CRC 及路径白名单均核对。新旧 APK 的公开签名证书不同，因此不能直接覆盖已安装的旧包；未读取私钥或签名凭证，未要求用户立即卸载当前可用应用。

## 服务器

腾讯云已隔离验证业务源码 `ae0dccb16b3ada7367f32c0c953b99f52bd2b1b6`，候选目录 `/opt/qiban/releases/v0.9.0-beta.1-ae0dccb16b3a`。云端 13 项测试、真实 HTTP 双账号、Web / 原生会话边界、工作区修订冲突、附件与 AI 配置隔离、响应账号绑定及 Caddy 配置均通过。测试使用随机凭证与临时目录，禁止外部 AI 请求，隔离服务不可访问生产数据目录。

上线前暂存状态：`/opt/qiban/deploy-staging/stage-v090.rm05Z3wg/status.txt` 报告 `VALIDATED`，工作单元成功退出。后续客户端、构建及文档提交没有更改候选服务端运行资源。

用户确认后，服务器已完成一致性备份及代码切换，生产 HTTPS 健康检查报告 **v0.9.0-beta.1 multiuser / apiVersion 1**。当前发布目录为上述 ae 候选；旧版本发布目录保留，回滚脚本已准备。备份只在服务器保存，目录权限 root:0700、归档 root:0600，摘要核验通过，没有查看或下载私人记录。

上线状态 `/opt/qiban/deploy-staging/switch-v090.QRNTBa72/status.txt` 为 `LIVE`，工作单元 `qiban-switch-v090-ae0dccb16b3a-1791607478` 成功退出，栖伴服务保持 active。私人备份路径 `/var/backups/qiban/v080-before-v090-ae0dccb16b3a-20261010T044438Z`；外层截图 `publication/v090-live-verified.png` 保存状态及权限核验结果。

公网边界复核：原生注册 / 登录使用空输入返回 400 输入校验，已越过旧版 Web 来源检查；原生请求带 Origin 或合成 Cookie 返回 403，匿名原生账号请求返回 401；Web 注册无 Origin 仍返回 403 来源错误，正确同源空输入返回 400。PWA manifest、Service Worker 与应用图标均可访问。没有创建生产测试账号或使用用户截图中的凭证。原安卓包 `/api/native/auth/register` 与现服务兼容，用户本人重试后已确认注册并登录成功。

## 尚未完成的实测

- 本机兼容的 Xcode 26.6 已安装并通过 Apple 代码签名和 Gatekeeper 核验。用户已亲自同意首次协议，首次组件检查已通过，官方 iOS 26.5 模拟器组件已安装。本机模拟器启动与安全存储验证通过；Apple ID 免费签名及连接、信任 iPhone 由用户本人完成，用户表示稍后处理，iPhone 尚未安装或验证。
- Android Studio、SDK 命令行工具及 JDK 21 已从官方来源安装。安装器 2019 基础许可不同于已确认的下载页条款，待用户确认后才能继续本机 SDK / 模拟器安装。云端 APK 和模拟器验证已完成，使用 APK 不依赖本机开发环境安装。
- Windows 安装流程、真实中文输入、另存为对话框尚未人工验收。
- 用户已确认安卓真实账号注册和登录。真实账号的完整业务、AI、手机键盘遮挡、系统文件选择 / 分享、横屏、后台切换及进程关闭后的完整业务恢复尚未在真实设备验收。程序测试和匿名启动检查不能代替这些验证。
- 服务器最新隔离验证、生产一致性备份、代码切换和公网接口边界检查均已通过。上线状态以实际服务器健康检查为准。

## 发布权限

本机 Git 推送此前实际返回 HTTP 403：`Permission to ciki-9876/qiban.git denied to ciki-9876`。已使用用户授权的 GitHub 连接器普通更新 main，使用 `force: false` 并核对旧分支 SHA。功能代码、Android 独立连接与 Xcode 模拟器构建修复均已发布；远端文件树与本机对应提交完全相等，未强制推送。各平台交付包的来源提交与实际验证范围见上文。
