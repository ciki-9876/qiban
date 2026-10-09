# 腾讯云多人部署

这是 v0.9.0-beta.1 的多人服务器入口，运行 `cloud-server.mjs`。原本的 `npm start` 仍是单人本机模式；GitHub Pages 仍是静态预览。

每个账号的工作区、AI 配置、成果文件和生成结果分别保存在 `/var/lib/qiban/users/<随机账号编号>/`。账号使用 scrypt 密码散列，登录使用七天有效的 HttpOnly / Secure / SameSite 会话 Cookie。原始密码和会话 Cookie 不写入日志，配置接口不会返回 API 密钥。

云版不读取浏览器的本机版存储，也不自动导入本机记录。登录后读取账号工作区，保存时使用修订号检查；多个页面同时修改会暂停冲突页面的同步，并提供导出，防止静默覆盖。文字修改先保存本机草稿，再同步；Web 使用 IndexedDB 与单账号窗口锁，安装应用使用系统加密存储。断网可查看已加载内容并继续当前文字，重开可恢复。冲突会暂停云端覆盖，完成导出后才能重新载入云端版本。退出会清理当前账号缓存。

当前提供最多 100 个自助注册账号，每个账号 200 MB 服务器空间、12 MB 工作区请求上限。账号密码至少 12 字符，登录与注册有限速。个人 AI 请求并发沿用本机版限制，整个服务最多六个 AI 请求同时进行。AI 服务仅支持列出的公共服务商，避免公网用户通过自定义地址访问服务器内网。

安装应用使用 `/api/native/` 独立 Bearer 会话，令牌仅存于 Keychain、Keystore 或系统加密存储。原生接口拒绝 Cookie 和 Origin，Web 接口继续检查同源及 CSRF；两类会话不互通。两类会话七天过期，退出即撤销，每账号合计最多五个会话。Web 缓存仅包含公开应用外壳及静态资源，不缓存 API、账号、AI 配置或带会话的页面。

每人需自行配置自己的 AI 服务；部署过程不会复制本机 API 密钥。暂未提供自助密码找回、邮件验证、管理员界面或付费功能。

## 启动

需要 Node.js 22+，服务端运行没有额外 npm 依赖；完整前端草稿测试需要仓库根目录 `npm ci` 安装开发依赖。

```sh
QIBAN_PUBLIC_ORIGIN=https://81.70.181.205 QIBAN_CLOUD_DATA_DIR=/var/lib/qiban node outputs/qiban-growth-prototype/cloud-server.mjs
```

生产部署使用 `qiban.service` 以独立低权限用户运行，后端只监听 `127.0.0.1:52160`；Caddy 提供 HTTPS。`qiban.caddy` 使用 Let's Encrypt 的 shortlived IP 证书配置；须在管理员批准公开访问和证书订阅协议后启用，并确认自动续期正常。云防火墙仅需 HTTP 80 和 HTTPS 443，不开放 52160 或 Caddy 管理接口。

使用 IP 地址访问时，在主 `/etc/caddy/Caddyfile` 的最前面加入以下全局配置，让不发送 SNI 的浏览器和客户端也能取得此 IP 的证书。如果已有全局选项块，将该选项合并到块内；站点导入仍放在全局块之后。

```caddyfile
{
    default_sni 81.70.181.205
}
```

Caddy 会保存 ACME 状态并自动续期短期证书；需持续保留端口 80/443、出站 HTTPS 和 `/var/lib/caddy`。可用 `journalctl -u caddy` 检查续期事件。

更新代码前备份 `/var/lib/qiban`（停服务后备份可保证一致性），将备份设为仅管理员可读。用发布目录与 `/opt/qiban/current` 链接切换版本；回滚代码时保留账号数据。备份含私人记录、密码散列和 AI 密钥，不能放入仓库或网页目录。服务器磁盘快满时先扩容或联系用户整理数据。

## 验证

```sh
npm ci
npm test
curl -H 'Host: 81.70.181.205' http://127.0.0.1:52160/api/health
curl https://81.70.181.205/api/health
```

首次访问会进入登录页。先创建自己的账号，再在产品内配置 AI。实际 AI 连接须由账号拥有者输入服务商密钥后测试。账户与附件隔离、跨站请求拒绝、会话失效和并发保存冲突均有独立测试。
