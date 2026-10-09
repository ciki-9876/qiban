# 栖伴手机测试版

本目录包含 Capacitor 8 的 Android 和 iOS 完整工程。应用标识为 `io.github.ciki9876.qiban.dev`，支持 Android 10+、iOS 16+，内置共享界面并连接 `https://81.70.181.205`。工程不使用远程 `server.url`、明文传输或证书校验绕过。

从仓库根目录构建共享资源、同步工程：

```sh
npm ci
npm run build:clients
cd clients/mobile
../../node_modules/.bin/cap sync
node sync-native.mjs
```

`sync-native.mjs` 在 Capacitor 同步后应用自定义插件、注册信息和平台要求。原生代码维护于 `native/`；工程中的同名文件由该脚本同步。图标及启动画面使用已有栖栖形象，若原图变化，运行 `python3 clients/mobile/generate-icons.py`（需要 Pillow）。

## Android

使用 Java 21、Android SDK 36、Build Tools 36.0.0；Android Studio 使用 Otter 或更新版本。SDK 下载及组件安装需要开发者亲自同意 [Android SDK 许可](https://developer.android.com/studio)。模拟器还需要 Emulator 和对应架构的系统镜像；Google APIs 镜像有单独许可。

配置 `ANDROID_HOME` 或工程未提交的 `local.properties` 后：

```sh
cd clients/mobile/android
./gradlew assembleDebug
```

测试 APK 位于 `app/build/outputs/apk/debug/app-debug.apk`，仅作测试，未使用用户签名密钥。不需要存储权限：导入使用系统文件选择器，导出使用系统文档创建器或共享菜单。

## iOS

使用完整 Xcode 26+，打开 `ios/App/App.xcodeproj`。首次在 Xcode 解析 Swift Package 依赖。模拟器可使用：

```sh
xcodebuild -project clients/mobile/ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

真机安装由用户在 Xcode 登录 Apple ID、选择自己的开发团队、连接并信任 iPhone，以及按系统提示确认测试设置。工程没有预设用户团队、账户或签名凭证。

## 安全桥与验证边界

`QibanNative` 的登录请求只向页面返回账号 ID、用户名和会话期限；Bearer 令牌由 iOS Keychain 或 Android Keystore 加密文件保存和发送。网络只允许固定 HTTPS 服务地址和有限的栖伴接口，关闭重定向以防令牌被发送给外部网站。

草稿按稳定账号 ID 分隔，使用 AES-GCM 加密并将账号文件名作为认证附加数据，拒绝跨账号互换密文；iOS 密钥为 `WhenUnlockedThisDeviceOnly`，安卓存储位于禁止备份的目录。密码、API 密钥、令牌等配置字段禁止进入草稿。退出需先成功撤销云端会话，再清理此账号草稿和本机登录信息；断网退出会提示重试。

`saveFile` 返回 `{ok:false}` 表示用户取消保存，单次原生导出文件上限为 16 MiB。共享文件写入应用临时目录，仅通过系统授权分享。原生桥拒绝 `file:`、`javascript:` 等外部链接。安卓返回键与两平台前后台切换发送 `qiban:back` / `qiban:lifecycle` 事件供共享页面处理。安卓网络请求使用独立线程池，长时间 AI 等待不会阻塞本机草稿写入队列。

JavaScript 桥契约测试：`node --test clients/mobile/tests/*.test.mjs`。安卓设备安全存储测试：`./gradlew connectedDebugAndroidTest`，验证加密、随机 nonce、篡改与密文互换拒绝、账号校验及配置字段拒绝，使用独立测试数据。

当前本机验证：3 项桥契约测试通过；Swift 语法解析、Xcode 项目和 plist 格式检查通过。`./gradlew assembleDebug` 实际返回“Unable to locate a Java Runtime”；`xcodebuild -version` 实际返回仅安装 CommandLineTools、需要完整 Xcode。APK 编译、安卓设备测试、iOS 编译和真机安装尚未完成；源码检查与桥测试通过不能替代这些验证。
