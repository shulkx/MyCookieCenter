# 中国联通 · Surge 凭据抓取

打开已登录的中国联通 App，在手机本地保存青龙脚本所需凭据，通过 BoxJS 查看和复制。不执行签到，不自动同步青龙，也不需要 Script Hub 转换。

## 文件

- [unicom.cookie.js](./unicom.cookie.js)：Surge 请求抓取脚本。
- [UnicomCookie.sgmodule](../../../surge/UnicomCookie.sgmodule)：原生 Surge 模块。
- [DaiDaiPanel.boxjs.json](../../../boxjs/DaiDaiPanel.boxjs.json)：含中国联通入口的 BoxJS 订阅（surge 分支）。

## 使用步骤

1. 按下方 Surge 安装方法启用模块，并开启 MITM。
2. 在 Surge 中生成、安装 CA 证书；在 iOS「设置 → 通用 → 关于本机 → 证书信任设置」中开启该证书的完全信任。
3. 确保 BoxJS 在同一台手机、同一个 Surge 环境下运行，添加或更新下方订阅。
4. 在多任务界面彻底关闭中国联通 App，再重新打开（冷启动会自动登录一次）。如果没有收到通知，在模块开启时退出账号并重新登录。
5. 收到「中国联通凭据 / 已保存到本机」通知后，刷新 BoxJS，进入「中国联通 · 青龙凭据」。通知只确认保存，不代表服务端登录验证成功。
6. 复制 `chinaUnicomCookie` 的整个值，在青龙「环境变量」中新增同名变量。不添加引号、字段名前缀或完整请求头。
7. 在青龙 Python3 依赖中安装 `requests`、`pycryptodome`，运行 [unicom_daily.py](../../../ql_script/unicom_daily.py)，检查是否显示「登录成功」。

环境变量值示例（仅示意，不是真实凭据）：

```text
你的Token#你的AppId
```

未捕获 AppId 时仅保存 Token，当前青龙脚本也接受这种格式。不要填写「手机号#服务密码」，该登录方式已停用。

### BoxJS 订阅

在已安装的 BoxJS 中添加或更新订阅：

```text
https://raw.githubusercontent.com/shulkx/MyCookieCenter/surge/boxjs/DaiDaiPanel.boxjs.json
```

与 [surge/README.md](../../../surge/README.md) 中的订阅是同一个，已添加过则刷新即可。

| 参数 | 用途 |
|---|---|
| `chinaUnicomCookie` | 最近一次捕获的联通凭据，可复制到青龙同名环境变量 |

切换联通账号会覆盖 BoxJS 中的值，不会自动追加。使用多个账号时，每抓取一个账号就先复制出来，再在青龙变量中按行放置各账号凭据。

## Loon

本次仅提供 Surge 安装配置，未提供或验证 Loon 适配。

## Surge

### 通过 URL 安装

在 Surge「模块」中从 URL 安装并启用：

```text
https://raw.githubusercontent.com/shulkx/MyCookieCenter/surge/surge/UnicomCookie.sgmodule
```

模块从 fork 的 `surge` 分支加载抓取脚本（带 `?v=` 内容哈希），并追加所需的 MITM 域名。已有 Script Hub 可以保留，无需转换此模块。

### 本地安装

将本目录的 [unicom.cookie.js](./unicom.cookie.js) 导入手机 Surge 的本地脚本目录，将 [UnicomCookie.sgmodule](../../../surge/UnicomCookie.sgmodule) 导入 Surge 的本地模块目录。在该本地模块中，把 `script-path` 后的远程地址改为导入的本地脚本路径；若脚本位于 Surge 配置目录根部，则使用 `unicom.cookie.js`。

## Quantumult X

本次未提供或验证 Quantumult X 适配，请勿直接作为该平台的重写脚本安装。

## Stash

本次未提供或验证 Stash 适配。

## 维护记录

| 日期 | 变更 |
|---|---|
| 2026-09-23 | 新增 Surge 本地抓取与 BoxJS 凭据管理，支持 Token 和 Token#AppId |
| 2026-11-23 | 发布到 fork 的 `surge` 分支：模块改从 fork 加载脚本，BoxJS 入口并入 DaiDaiPanel 订阅 |
| 2026-11-23 | 适配 iOS 联通 App 13.2 的新登录域名，冷启动与重新登录后都能抓到当前有效凭据 |

## 已知限制

- 仅在匹配的联通请求经过 Surge 且可被 HTTPS 解密时触发；手动点击运行脚本不会获取凭据。App 版本变更或拒绝解密时，可能无法抓取。
- 模块只提取请求中的凭据，不修改请求，也不主动发送网络请求；但 Surge/BoxJS 自身的抓包、备份与同步设置仍需自行保护。
- 凭据未变化时不会重复通知。BoxJS 页面为空时先更新订阅、刷新页面，确认模块、MITM 和证书信任已启用，并检查是否有其他脚本优先匹配同一请求。
- 凭据复制到青龙后，不要在手机上退出联通账号：退出登录会作废当前凭据，需重新抓取。
- 凭据失效后需重新抓取，并手动更新青龙；不保证永久有效。只缺少 AppId 的请求不会清除同一 Token 已保存的 AppId，但不会借用另一 Token 的 AppId。
- 抓取后可以关闭模块以停止收集。清空 BoxJS 字段只删除本机保存值，不会撤销服务端登录凭据。
- 通知和脚本日志不显示完整凭据。不要分享 BoxJS 截图、请求正文、导出数据或含凭据的日志。
- 已使用 Node.js 模拟 Surge 环境验证提取与保存逻辑，尚未在真实 iPhone、Surge 和联通账号上验证。