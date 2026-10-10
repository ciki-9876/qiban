# 栖伴四端测试版

版本 `0.9.0-beta.1`，应用标识 `io.github.ciki9876.qiban.dev`。四端共用现有前端和云端账号，安装应用固定连接 `https://81.70.181.205`，内置页面资源，外链进入系统浏览器。单人本机版与 GitHub Pages 静态预览继续保留。

| 平台 | 工程与交付 | 最低平台 |
| --- | --- | --- |
| Web | 云服务、PWA manifest、公开应用外壳缓存 | 当前主流浏览器，草稿编辑需要 Web Locks 和 IndexedDB |
| iOS | [完整工程](mobile/README.md)、Keychain 会话、加密草稿 | iOS 16+，构建需要完整 Xcode 26+ |
| 安卓 | [完整工程](mobile/README.md)、Keystore 加密会话及草稿、测试 APK | Android 10+，Java 21 / SDK 36 |
| Windows | [Electron 工程](windows/README.md)、系统加密会话及草稿、EXE / ZIP | Windows 10/11 x64 |

## 构建

```sh
npm ci
npm run build:clients
npm test
npm run mobile:sync
npm ci --prefix clients/windows
npm run build:windows
```

`build:clients` 仅复制明确允许的界面资源；后端、账号、AI 配置、测试数据与签名材料不会进入包。iOS / 安卓原生工程中的界面资源由同步生成，修改后需重新同步。GitHub Actions 会在 Windows 执行器生成安装 EXE 和 ZIP，并实际启动已打包应用；安卓任务生成 APK。

## 账号、同步和文件

Web 保留 Cookie、同源检查与 CSRF；安装应用通过平台桥使用 `/api/native/` 独立 Bearer 会话，页面得不到令牌。账号 ID 隔离本机草稿，密码与 AI 密钥不进入客户端缓存。文字先写本机，再同步修订号；离线可查看已加载内容和继续草稿，新目标、归档、AI 与上传需联网。冲突后继续保留本机输入，完成导出后才能载入云端版本。退出先处理未同步内容，再清该账号缓存。

手机支持文件选择器导入、系统保存 / 分享和后台恢复；Windows 使用另存为；Web 下载并在支持时分享。测试版手机单个导出文件上限为 16 MiB；全量历程含较多附件时可能超限，需要使用 Web 或 Windows 完成全量导出；取消手机导出会保留草稿。未加入通知、商店上架或付费签名。

安装步骤见 [安装说明](INSTALL.md)，实际验证和未完成项目见 [测试报告](TEST-REPORT.md)。
