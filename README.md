# 栖伴 · Qiban

一款围绕个人目标、微小行动与成长记录的工具原型。纸白背景、紫苏色与安静呼吸的兔子栖栖，陪你一点点把想法做出来。

目前版本：**0.9.0-beta.1**（四端测试版）。

四端共用目标、归档、记录、AI 和附件功能，使用同一云端账号。Web 支持添加到桌面；iOS / 安卓采用 Capacitor，Windows 采用 Electron，安装应用内置页面并默认连接 `https://81.70.181.205`。构建步骤与验证范围见 [四端说明](clients/README.md)。

目前支持：

- 多目标管理：完成归档、暂存、回看与重新打开；每个目标的记录独立保存。
- 新目标可直接开始，本机版可用 AI 生成阶段与多个可选微行动。
- 目标阶段与多个可选行动；调整、替换和暂不做。
- 保留每次尝试，回看版本变化，分别记录采用状态与评价。
- 阶段讨论、收尾与重访，回顾上次进度。
- 栖栖带回的真实调研，可切换、收藏和反馈；内容类型开放。
- 本机版接入 OpenAI 兼容服务，支持 AI 辅助、反馈与成果图片。

## 在线预览

[打开栖伴](https://ciki-9876.github.io/qiban/)

GitHub Pages 发布的是静态界面预览。目标、行动、归档和收藏保存在当前浏览器；本机版的 AI 服务与图片上传不在此预览中。首次打开不会带入其他浏览器或旧本机地址的历史记录。

## 本机运行

服务器多人版另见 [部署说明](deploy/README.md)：账号、记录、附件和 AI 配置独立保存，通过 HTTPS 访问。

需要 Node.js 22 或更新版本，无第三方 npm 依赖。

```sh
cd outputs/qiban-growth-prototype
npm start
```

打开终端显示的 `http://127.0.0.1:52160/`，在产品内配置自己的 AI 服务。密钥保存在本机私有目录；不要提交 `work/`、配置文件或个人记录。

本机服务面向单人本地使用。多人服务使用部署说明中的账号隔离与 HTTPS 配置，不要将单人本机模式直接暴露到公网。

## 开发与部署

```sh
python3 outputs/qiban-growth-prototype/build.py
node --test outputs/qiban-growth-prototype/tests/*.test.mjs
python3 scripts/build-pages.py
```

`outputs/qiban-growth-prototype/` 是源码，`docs/` 是构建后的预览。修改后重新生成并提交 `docs/`。GitHub 仓库 Settings → Pages 选择 Deploy from a branch，`main` 分支、`/docs` 目录。

研究示例标明引用来源和日期；翻译、研究范围与应用想法分别注明。当前接入已完成的研究，没有自动联网外出服务。
