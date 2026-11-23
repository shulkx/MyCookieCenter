# Surge 模块

本目录只存在于 fork 的 `surge` 分支，为 Surge 提供原生模块，不需要 Script Hub 转换。

| 模块 | 用途 |
|---|---|
| [CookieCenter.sgmodule](./CookieCenter.sgmodule) | 微信读书、中国电信凭据抓取与手机端定时任务 |
| [UnicomCookie.sgmodule](./UnicomCookie.sgmodule) | 中国联通凭据抓取（仅抓取，无定时任务） |

## 安装

在 Surge「模块」中选择从 URL 安装：

```text
https://raw.githubusercontent.com/shulkx/MyCookieCenter/surge/surge/CookieCenter.sgmodule
https://raw.githubusercontent.com/shulkx/MyCookieCenter/surge/surge/UnicomCookie.sgmodule
```

两个模块互不依赖，按需安装。

1. 开启 MITM，生成并安装 CA 证书，在 iOS「设置 → 通用 → 关于本机 → 证书信任设置」中开启完全信任。
2. 模块用 `%APPEND%` 追加所需域名，不覆盖已有的 MITM 主机名。
3. 不要同时启用旧的本地模块或 gist 版本，避免规则重复。
4. 模块内全部脚本从本 fork 的 `surge` 分支加载，原作者仓库的改动不会直接影响手机。

## BoxJS

BoxJS 需另行安装，并与 Surge 在同一台手机上运行。添加订阅：

```text
https://raw.githubusercontent.com/shulkx/MyCookieCenter/surge/boxjs/DaiDaiPanel.boxjs.json
```

订阅只用于查看、编辑凭据，单独添加订阅不会开启抓取。Loon 中保存的数据不会迁移到 Surge。

## 微信读书

1. 打开微信读书「我」页面，会收到「尚未抓全」通知，列出还缺的部分。
2. 在 App 内退出并重新登录一次，抓取换票凭证 `refreshToken`。
3. 打开「翻牌」或「限免」活动页补齐 Web 票据，收到「满血凭据」通知即完成。
4. 在 BoxJS「微信读书」中复制 `weread_auth_v2`，粘贴到青龙 `WEREAD_AUTH`。

多账号：先复制当前账号，再切换账号抓取，抓到新账号时会收到「切换账号」通知，BoxJS 中的值会被新账号替换。青龙 `WEREAD_AUTH` 中多个账号要写成 JSON 数组：

```text
[{"vid":"账号A",...},{"vid":"账号B",...}]
```

每行一个 JSON 或建多个同名变量，当前青龙脚本无法解析。只做限免助力的小号可以放进 `WEREAD_HELPER_AUTH`。

## 中国电信

| 凭据 | 操作 | BoxJS 位置 |
|---|---|---|
| 会员抽奖 SessionKey | 微信打开「中国电信5G会员」小程序，进入会员日或权益商城页面 | 中国电信 · 5G会员抽奖 |
| 等级权益 | 电信营业厅 App → 我 → 签到 / 等级权益 | 中国电信 · 等级权益秒杀 |
| 山西福利 | 打开山西活动页面 | 中国电信 · 山西领福利 |

在青龙运行电信任务时，变量 `dxlin` 的格式为：

```text
手机号#服务密码#AndroidID#SessionKey
```

SessionKey 可省略，多账号换行或用 `&` 分隔。模块不会自动同步青龙，凭据失效后需要重新抓取、复制。

## 中国联通

1. 安装并启用 `UnicomCookie.sgmodule`，打开已登录的联通 App 刷新首页；没有触发时退出账号重新登录一次。
2. 收到「中国联通凭据 / 已保存到本机」通知后，在 BoxJS「中国联通 · 青龙凭据」中复制 `chinaUnicomCookie`。
3. 粘贴到青龙同名变量 `chinaUnicomCookie`，格式为 `Token#AppId`，不加引号。

详见 [scripts/tools/unicom/README.md](../scripts/tools/unicom/README.md)。

## 定时任务

按手机本地时间执行：

| 任务 | 时间 |
|---|---|
| 微信读书阅读奖励 | 每天 23:00 |
| 微信读书翻牌 | 周二 20:00 |
| 微信读书限免图书 | 周五 10:00 |
| 电信会员抽奖 | 周三 09:00 |
| 电信等级话费 | 每天 23:59 启动，脚本等待到目标时间执行 |
| 山西福利监控 | 每月 1 至 8 日，08:00 至 19:59 每 20 分钟 |

定时任务设置了超时和 iOS 唤醒，但仍受系统调度和网络影响，不保证准点。

## 注意事项

- 只想用其中一项时，在本地模块副本中删除另一项的脚本行：微信读书为 `CookieCenter-WeRead-` 开头，电信为 `CookieCenter-Telecom-` 开头。
- 电信会员抓取脚本在 `$done()` 后的延时抽奖会被 Surge 取消，请依赖周三的定时任务或 BoxJS 手动运行，而不是「打开小程序立即抽奖」。
- 山西福利抓取脚本在捕获时可能直接领奖，删除 cron 不能把模块变成纯抓取。
- 手机与青龙同时运行同一任务会重复消耗活动机会，选定一个执行端。
- 不要公开 Cookie、SessionKey、服务密码、BoxJS 截图或备份。

## 与原仓库的差异

`surge` 分支在原仓库 `main` 之上增加：

- 本目录的 Surge 模块。
- 中国联通抓取脚本 `scripts/tools/unicom/`，以及 `boxjs/DaiDaiPanel.boxjs.json` 中的「中国联通 · 青龙凭据」入口。
- 修复 `scripts/weread/weread_cookie.js`：删除导致 Surge/Loon 语法错误的 `export` 行；未抓全时也发通知；切换账号时不再把两个账号的凭据拼在一起。

`main` 分支与原仓库保持一致，可以直接用 GitHub 的「Sync fork」同步；之后把 `surge` 分支 rebase 到新的 `main` 上，并重新计算模块中的 `?v=` 参数。
