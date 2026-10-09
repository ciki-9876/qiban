# v0.9.0-beta.1 验证记录

日期：2026-10-09。全部测试使用独立、临时测试数据，没有读取真实账号密码、AI 密钥、凭证文件或私人记录。

## 已执行

- `npm test`：161 项全部通过，覆盖原业务、目标归档与创建、原生会话隔离 / 过期 / 撤销、账号缓存隔离、离线重启草稿、跨设备修订冲突、账号切换立即锁屏、工作区响应身份绑定、旧原生请求 / 退出不能影响新账号、Web 文件分享取消、取消导出保护、上传期间继续修改、合同 / 阶段 / AI 计划表单恢复、Web 单窗口锁、PWA 私人响应不缓存、Windows 安全边界和手机桥。
- `node scripts/test-pages.mjs`：2 项通过；单文件原型与 Pages 预览已重新生成。
- 共享客户端与 Capacitor Android / iOS 同步成功；Swift 语法、Xcode 工程 / plist lint、JavaScript 语法和差异格式检查通过。
- 独立云服务浏览器验证：中文输入、创建目标、完成归档与重开表单草稿。390 × 844 手机尺寸检查：输入 16 px、主要按钮 44 px、对话框宽 358 px；修复了项目对话框横向裁切。
- Windows 安全测试与 macOS 上隔离用户目录的 Electron 启动、真实系统加密存储往返验证通过。安装包已在 macOS ARM 交叉构建，并验证包内仅含明确允许的界面资源。最终 EXE 为 132230748 字节，SHA256 `f0ce745589bb3f11835f9228e299147e97a986a69cbaa9e15ff95f3775597333`；ZIP 为 164606153 字节，SHA256 `6c02342527c663b5e537ef6ec64481f14b092ad78a340f8d44677dab9f76a87d`。校验文件位于本机 artifacts/windows/SHA256SUMS.txt。
- 提交扫描覆盖源码及生成客户端；未发现真实密钥、私人记录、会话令牌或本机私有路径，构建清单排除服务器代码及私人配置。
- [GitHub Windows 构建与启动验证](https://github.com/ciki-9876/qiban/actions/runs/37931453026)已成功：打包 EXE 的内置登录页、沙箱、原生桥和真实系统加密往返通过。Actions 产物已下载、展开并核对归档 SHA-256；Windows 构建的 EXE SHA256 为 `8e033ebd07b803747717302303343c0ad135cf59df6cc7f4fd11e6c5c3a397d3`，ZIP 为 `ebad67c5d2a5c3c5244dba123578aabc7cc02782c80788e23c821b0512ac459f`。安装、中文输入和另存为对话框尚未进行人工验收。
- [GitHub iOS 模拟器构建与启动验证](https://github.com/ciki-9876/qiban/actions/runs/37931453048)完成编译、安装、启动、进程存活检查与截图（`startup_only`）。截图复核发现 Keychain 初始化错误与安全区域顶部重叠，不能据此报告 iOS 功能验证通过。修复已加入 Simulator 专用 ad-hoc 签名、独立 Keychain / 加密草稿测试及登录页几何检查；需要新一轮 CI 验证。
- 腾讯云已将 `9c397a7993b56c05da6610100dbf03e074a82ab3` 暂存为隔离候选版本，云端测试、真实 HTTP 账号 / 会话 / 工作区 / 附件 / AI 配置隔离和 Caddy 配置验证通过。生产服务仍为 v0.8.0，尚未执行备份与切换。

## 尚需实际完成

- Android 模拟器验证：[GitHub 构建](https://github.com/ciki-9876/qiban/actions/runs/37933907773)已成功生成 APK，已下载并核对 Actions 归档校验值。APK 为 12440812 字节，SHA256 `9ce98f61edd0630b6213dd65732df9fcdaccb759390e14e553539bdb82fef494`，保存于本机 artifacts/android-ci-8bb2a44/app-debug.apk。模拟器界面与安全存储尚待验证。本机 Android Studio、SDK 命令行工具与 JDK 21 已从官方来源安装并核验；安装器的 2019 基础许可不同于已确认的下载网页条款，仍待用户亲自确认。
- iOS：本机兼容的 Xcode 26.6 已安装，并通过 Apple 代码签名与 Gatekeeper 核验；首次许可确认及组件配置仍待用户本人完成。本机模拟器及 iPhone 签名安装尚未完成。
- Windows：GitHub Windows 构建及启动验证已完成；安装流程、中文输入和文件对话框仍待人工验收。
- 服务器：包含账号切换保护的新候选版本还需重新隔离验证；上线时须备份私人数据、保留 v0.8.0 回滚目录。生产备份与切换尚未执行，需等待切换确认及本机解锁；上线状态以实际服务器健康检查为准。
- 真实账号 / AI、手机系统键盘、系统分享、真实设备后台切换和进程关闭验收仍需实测；程序测试不能代替这些验证。Web 已提供保留下载的系统文件分享入口，分享前再次点按钮以保持浏览器用户手势；实际系统分享菜单尚未人工验收。

## 权限与发行

本机 Git 推送返回 HTTP 403：`Permission to ciki-9876/qiban.git denied to ciki-9876`。已使用用户授权的 GitHub 连接器将 main 普通更新至 `8bb2a44ce08f33c591b9c54da53cfbc1918e9c3e`，明确使用 `force: false` 并核对旧分支 SHA。远端文件树与本机通过验证的源码完全相等，未强制推送。后续修复提交、构建及部署结果仍以实际成功记录为准。
