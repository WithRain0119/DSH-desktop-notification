---
description: "DSH 桌面/邮件通知插件：一轮对话结束、需要你确认或出错时，在屏幕右下角弹出毛玻璃卡片，并可同时发送邮件。"
kind: "package-reference"
---

# dsh-desktop-notification

## Summary

`dsh-desktop-notification` 把 DSH（DeepSeek Harness）的 Agent 事件变成桌面提醒：一轮对话结束、工具审批等待你确认、Agent 向你提问、或任务出错时，屏幕右下角弹出毛玻璃卡片并播放提示音；打开邮件通知后，同一条提醒还会发到邮箱，手机也能收到推送。

它同时提供 Host 与 Client 两半：Host 半部订阅 DSH 的 Agent 事件并负责弹窗、邮件与日志；Client 半部把「通知」页注册进 DSH 设置面板，所有开关与 SMTP 参数都在图形界面里改、改完立即生效。弹窗基于 Windows 自带的 PowerShell + WinForms 自绘，不经过系统通知中心，也不引入额外运行时组件。

本项目是 ClaudeBell（Claude Code hook 版）的 DSH 移植：通知渠道、卡片外观、提示音、按日期日志、邮件配置全部保留，触发源从 Claude Code 的 `Stop` / `Notification` hook 换成 DSH 自己的 Agent 事件。

## Table of Contents

- [Use this plugin](#use-this-plugin)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)
- [License](#license)

-----

<a id="use-this-plugin"></a>
## Use this plugin

装好之后无需再配置任何东西：默认开启桌面弹窗，任务结束就会提醒。邮件、通知时机、卡片时长都在 **设置 → 通知** 里按需调整。

### When to choose it

适合把 DSH 当长任务后台用的场景：跑着生成或批处理时切去干别的，结束时用一张卡片把你叫回来；开启审批与提问提醒后，不必盯着窗口等确认。想要系统托盘、手机 App 推送或 webhook 转发，应选别的插件——本插件的第二渠道是**邮件**。

### Requirements

| 项 | 要求 |
|---|---|
| 插件版本 | `0.2.0` |
| DSH 桌面端 | 在 `0.2.0-rc.2` 上开发与验证 |
| 操作系统 | Windows 10/11（弹窗依赖 PowerShell + WinForms；其他平台只能走邮件） |
| Node.js | 18+，仅用于安装插件依赖与运行自测脚本 |

### Smallest working setup

**第 0 步：先装插件自己的依赖。** DSH 安装本地路径插件时使用 pnpm 的 `link:`（软链接），**不会**替你安装插件目录里的依赖；缺依赖时 Host 半部会在导入 `@deepseek-ai/schemastery` 处失败，插件页只显示一句 `failed to import`。

```powershell
# 在克隆下来的仓库根目录（含 package.json 的那一层）执行
npm install
```

**方式一：在 DSH 里安装（推荐）。** 打开侧边栏 **插件** 页 → **添加插件** → 在包名输入框填本仓库根目录的绝对路径（即上一步 `npm install` 所在目录）→ **安装**。DSH 会把它作为 bundle 装进当前 profile（`dsh.profile.bundles` 增加 `dsh-desktop-notification`）并自动启用。

> 本插件目前**不经 npm 分发**，请按本地路径安装；把仓库克隆或解压到任意目录都可以，路径里带空格与中文不影响。

**方式二：手动软链接（开发用）。**

```powershell
# 在仓库根目录执行
$profile = Join-Path $HOME '.dsh\profiles\desktop'
New-Item -ItemType Junction -Path "$profile\node_modules\dsh-desktop-notification" -Target (Get-Location)
# 并在 $profile\package.json 的 dsh.profile.bundles 里加入 "dsh-desktop-notification"
```

> 如果插件页提示 `dsh-desktop-notification (notify-desktop): failed to import`，重启一次 DSH 桌面端再试：插件代码在 Host 进程里按模块缓存，一次导入失败会被缓存到进程结束。

### Configuration

设置入口：**侧边栏 → 设置 → 通知**（排在 General / Models / Plugins 之后）。所有字段都是 schemastery 的 volatile 字段——改动只更新运行中的引用，不重载插件，也不需要重启。

| 分组 | 字段 | 默认值 | 含义 |
|---|---|---|---|
| 桌面弹窗 | `desktop.enabled` | `true` | 桌面卡片总开关 |
| | `desktop.sound` | `true` | 卡片出现时播放随包提示音 |
| | `desktop.timeoutSec` | `10` | 卡片自动消失秒数，范围 1–120；点卡片可提前关闭 |
| 通知时机 | `events.taskComplete` | `true` | 一轮对话结束、Agent 回到 idle 时通知 |
| | `events.needInput` | `true` | 工具审批、Agent 提问时通知 |
| | `events.error` | `false` | 某一步或某一轮出错时通知 |
| | `ignoreSubagents` | `true` | 只通知主会话，忽略 subagent 与 workflow 子任务 |
| 邮件通知 | `mail.enabled` | `false` | 每条通知同时发一封邮件 |
| | `mail.smtpHost` | 空 | SMTP 主机名，例如 `smtp.qq.com`（**不是**邮箱地址） |
| | `mail.smtpPort` | `587` | SSL 用 465，STARTTLS 用 587 |
| | `mail.smtpSecure` | `false` | 是否 SSL 直连（QQ / 163 / Gmail 选开） |
| | `mail.smtpUser` | 空 | SMTP 用户名，通常是完整邮箱地址 |
| | `mail.smtpPass` | 空 | SMTP 授权码；`role('secret')`，只写不读 |
| | `mail.from` | 空 | 发件人，多数邮箱要求与 SMTP 用户名一致 |
| | `mail.to` | 空 | 收件人，填自己即自己发给自己 |

改动写入当前 profile 的 `cordis.patch.yml`，即 `id: notify-desktop` 那一行的 `config`。

**关于 `mail.smtpPass`。** 它是只写字段：DSH 的设置接口不会把密文读回浏览器，所以输入框永远不会回显已保存的值——这不是没保存。判断依据是标签后的角标：**未配置**（还没填，占位提示「请输入 SMTP 授权码」）、**已配置**（已保存，占位提示「已配置，留空表示不修改」）；保存中显示「保存中…」，成功短暂显示「已保存」。保存失败会保留你刚输入的内容。想换直接输新的，想清空点右侧「清除」。

### Email setup (QQ Mail example)

1. 登录 QQ 邮箱 → 设置 → 账户 → 开启 **SMTP 服务**，取得 **16 位授权码**；
2. 在 **设置 → 通知 → 邮件通知** 点 **QQ 邮箱** 预设（一次写入服务器、端口与 SSL 三项），再补齐用户名与授权码：

```
SMTP 服务器   smtp.qq.com
端口          465
使用 SSL      开
SMTP 用户名   你的 QQ 邮箱
SMTP 授权码   你的 16 位授权码
发件人        你的 QQ 邮箱
收件人        你的 QQ 邮箱
启用邮件通知   开
```

其他服务商：

| 邮箱 | `smtpHost` | `smtpPort` | `smtpSecure` |
|---|---|---|---|
| QQ 邮箱 | `smtp.qq.com` | `465` | `true` |
| 163 邮箱 | `smtp.163.com` | `465` | `true` |
| Gmail | `smtp.gmail.com` | `465` | `true` |
| Outlook | `smtp.office365.com` | `587` | `false` |

若 `smtpHost` 里出现 `@`，设置页会就地提示「应填主机名，而不是邮箱地址」。

### What a notification shows

同一条通知要能在多个会话之间区分开，所以卡片正文第一行是定位信息，第二行才是事件细节：

```
DSH 任务完成
DSH-desktop-notification › 改插件设置页
任务已完成，可以回来看看结果了
```

| 显示 | 来源 |
|---|---|
| 工作区 | `workspaceRegistry.list()`：先按 `sessionIds` 认领该会话，再按会话目录 `SessionHeader.cwd` 匹配；目录尚未注册为工作区时退回文件夹名 |
| 对话 | `sessionTitle.get(session).title`，即侧边栏显示的会话标题；手动重命名过则显示用户起的名字 |
| 会话 id | 只进日志，不进卡片，也不进邮件 |

邮件同用这套信息：标题为 `DSH 任务完成 · 工作区 › 对话`，正文结构化列出事件 / 工作区 / 对话 / 时间，空一行后写事件细节。字段超过 28 字按省略号截断，避免撑破 320px 的卡片。

拿不到就降级：没有对话标题时不输出空的「›」；连会话都查不到时整行省略，不会退回会话 id 短码。

### Self test

**在 DSH 里**——任意会话输入框：

```
/notify-test
/notify-test need_input
/notify-test error
```

命令按当前设置真的发一条通知，并报告走了哪些渠道。它**不受「通知时机」开关限制**：测试的目的就是验证链路，所以哪怕该事件在设置里关着也会强制发送，并在结果里提醒「正式场景不会通知」。确实发不出去时，结果直接点名原因：桌面开关关着 / 当前不是 Windows / 邮件开关关着 / 邮件发送失败。

**不启动 DSH**——命令行自测工具：

```powershell
node bin/dsh-notify-test.js test                                          # 弹窗 + 提示音
node bin/dsh-notify-test.js test need_input --timeout 5                   # 指定文案与时长
node bin/dsh-notify-test.js test --no-sound                               # 静音
node bin/dsh-notify-test.js test --workspace 项目名 --conversation 对话名 # 复现定位行排版
node bin/dsh-notify-test.js test --mail                                   # 连邮件（读 SMTP_* / MAIL_*）
```

### Logs

按日期分割，位于 DSH 主目录下：

```
<DSH_HOME>/logs/notify-desktop-YYYY-MM-DD.log      # DSH_HOME 默认 ~/.dsh
```

- 目录由 `DSH_HOME`（默认 `~/.dsh`）推导，也可用环境变量 `DSH_NOTIFY_LOG_DIR` 直接指定；
- Node 侧与弹窗进程写同一个文件，`[popup]` 前缀的行来自 PowerShell；
- SMTP 密码与授权码一律不入日志；会话 id 只出现在「通知调度开始」行末尾，便于按时间点排查。

### Troubleshooting

| 现象 | 处理 |
|---|---|
| 插件页提示 `failed to import` | 先在插件目录执行 `npm install`；仍失败则重启 DSH 桌面端（模块缓存） |
| 装完没有弹窗 | 确认 `desktop.enabled` 为开；执行 `/notify-test`；再看日志——有 `桌面弹窗已启动` 而无 `[popup]` 行说明弹窗进程没起来（策略拦截或杀软），有 `[popup] ERROR` 则行尾带异常 |
| 只看到最后一条通知 | 预期行为：新卡片先关闭旧卡片，避免旧卡片被抓进新卡片的毛玻璃背景导致画面发灰 |
| 子 Agent 结束也弹 | 打开 `ignoreSubagents`（默认已开） |
| 邮件 `Invalid login: 535` | 用了邮箱登录密码，应改用 SMTP 授权码 |
| 邮件 `ETIMEDOUT` / `ECONNREFUSED` | 端口与加密方式不匹配（QQ/163 用 465 + SSL），或网络屏蔽 SMTP |
| 邮件 `Mail from must equal authorized user` | `mail.from` 必须与 `mail.smtpUser` 一致 |
| 日志显示已发送但没收到 | 查垃圾邮件箱；换一个收件邮箱再试 |

### Upgrade and uninstall

本插件按本地路径安装，没有自动更新。

**升级**（在仓库根目录）：

```powershell
git pull
npm install      # 依赖有变化时需要
```

然后重启 DSH 桌面端。Host 半部的代码改动只有重启才生效；Client 半部（设置页）会被 HMR 在约 500ms 内热替换，刷新页面即可看到。

**卸载**：在插件页找到 `dsh-desktop-notification` → 卸载；或手动执行：

```powershell
$profile = Join-Path $HOME '.dsh\profiles\desktop'
# 1) 从 $profile\package.json 的 dsh.profile.bundles 里删掉 "dsh-desktop-notification"
# 2) 删掉软链接（cmd /c rmdir 只删链接本身，不会影响仓库目录）
cmd /c rmdir "$profile\node_modules\dsh-desktop-notification"
# 3) 清掉 $profile\cordis.patch.yml 里 id: notify-desktop 的那一段（保存过的设置也一起清掉）
```

`<DSH_HOME>/logs/` 下已生成的 `notify-desktop-*.log` 可自行删除。

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

本节说明设计取舍与实现位置；可观察行为已在上方 [Use this plugin](#use-this-plugin) 覆盖。

### Event mapping

| DSH 事件 | 通知类型 | 接线方式 |
|---|---|---|
| `agent/status`（`running` → `idle`） | 任务完成 | `ctx.on`，只在状态真正回落时通知 |
| `approval/request` | 需要你确认 | waterfall 监听：先发通知，再 `return next()` |
| `user-questions/request` | 需要你确认 | waterfall 监听：同上 |
| `agent/error` | 任务出错 | `ctx.on`，默认关闭 |
| `subagent/start` / `subagent/end` | —（过滤用） | 记录子会话 id，配合 `ignoreSubagents` 跳过 |

### Why `running` → `idle` instead of a stop hook

Claude Code 有 `Stop` 事件可用，DSH 没有等价物，因此改用 Agent 状态机：`agent/status` 的 `idle` 表示「没有派发中的驱动」，正是任务结束的语义。但新建会话、恢复会话、被中断的空闲同样会产生 `idle`，所以插件自己维护一个 `running` 集合：**只有先观察到 `running`、再观察到 `idle` 才通知**，同一个 `idle` 不会重复通知。

### Observe-only on waterfalls

审批与提问都是 waterfall 事件，监听器可以拦截决策。本插件只做旁听：先投递通知（不 await），然后立即 `next()` 把决策权交回，因此既不改变审批结果，也不延长界面等待。通知链路上的任何异常都在插件内部吞掉并记日志。

### Subagent filtering

`subagent/start` / `subagent/end` 携带子会话 id，插件用它们在内存里维护一个集合。`ignoreSubagents` 打开时，这些会话结束不弹窗——否则每次委派都会多一条无意义的提醒。集合随 `subagent/end` 收缩，不会无限增长。

### Desktop popup

卡片由 `lib/popup.ps1`（PowerShell + WinForms）绘制，`lib/desktop.js` 以 `cmd /c start /b powershell …` 拉起，让它彻底脱离宿主进程树：

- **DPI**：进程声明 Per-Monitor V2 感知，几何尺寸按真实 DPI 缩放，避免高分屏下文字被裁切；
- **毛玻璃**：系统 Acrylic 在无边框窗口上只渲染成纯灰底，因此改为抓取卡片背后画面 → 降采样模糊 → 放大 → 叠乳白磨砂层，并以 31ms（约 2 个系统滴答）定时重抓，让玻璃跟随背景变化；
- **定位**：右下角，任务栏可见时以其顶边为上边界；
- **去重**：弹出前按窗口标题找到上一张卡片并 `WM_CLOSE`，通知不堆叠；
- **截图隐身**：对窗口设置 `WDA_EXCLUDEFROMCAPTURE`，人眼可见但不进截图与录屏——这是实时毛玻璃的前提，否则定时抓屏会抓到自己；
- **提示音**：同进程用 WPF `MediaPlayer` 播放 `assets/bell.mp3`；
- **参数**：标题与正文以 Base64 传参，绕开命令行中文编码问题。

### Host/Client split and configuration

- **Host 半部**（`lib/host.js`）导出 `name` / `inject` / `Config` / `apply`，订阅事件、解析定位信息、调度通知。设置全部声明为 `.volatile()`——这既是 DSH 设置表单只投影 volatile 字段的前提，也让改动无需重载插件。
- **Client 半部**（`lib/client.js`）是一个手写的 `window.__ModuleLoader__.load({ id, factory })` 模块：用 `ctx.configForms.get('notify-desktop')` 读写设置，用 `describe()` 的 `secrets[{ path, set }]` 判断授权码是否已配置，并通过 `ctx.slots.inject('settings.section', …)` 注册设置页；`whileServed` 保证插件被关闭时不会留下空页面。
- **命名**：包名是 `dsh-desktop-notification`（等于 client bundle id，DSH 要求二者一致）；Loader 行 id、设置命名空间与日志前缀同为短名 `notify-desktop`。之所以不叫 `dsh-notify`，是因为 npm 上已有同名插件，避免在插件页按名字安装时装错。

### Source map

| 文件 | 职责 |
|---|---|
| [`lib/host.js`](lib/host.js) | Host 入口：Config schema、事件监听、`/notify-test` 命令、工作区与对话解析 |
| [`lib/notify.js`](lib/notify.js) | 通知调度与排版：事件开关、卡片正文、邮件标题与正文 |
| [`lib/desktop.js`](lib/desktop.js) | 以独立进程拉起 `popup.ps1`（Base64 传参、日志路径、提示音） |
| [`lib/email.js`](lib/email.js) | nodemailer 懒加载与发送，失败只记日志 |
| [`lib/logger.js`](lib/logger.js) | 按日期分割的日志，目录由 `DSH_HOME` 推导 |
| [`lib/popup.ps1`](lib/popup.ps1) | 自绘毛玻璃弹窗（PowerShell + WinForms） |
| [`lib/client.js`](lib/client.js) | Client 半部：设置页、授权码状态、邮箱预设 |
| [`cordis.patch.yml`](cordis.patch.yml) | bundle 补丁：插入 `id: notify-desktop` 的 Loader 行与出厂默认值 |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

本项目不依赖 DSH 之外的框架，但用到了 DSH 运行时的若干公开扩展点。需要深入时，读对应包的 README（位于安装目录 `resources/app.asar` 内的 `dsh/node_modules/@deepseek-ai/` 下）：

- `@deepseek-ai/dsh-settings` — 设置文档、volatile 字段的投影规则、secret 脱敏；
- `@deepseek-ai/dsh-client-ui-settings` — `ctx.configForms`（`get` / `describe` / `whileServed`）与 `settings.section` 槽位约定；
- `@deepseek-ai/dsh-client-modules` — `window.__ModuleLoader__` 的 bundle 协议、`/plugins` 路由与 HMR 重载；
- `@deepseek-ai/dsh-agent` / `@deepseek-ai/dsh-agent-loop` — `agent/status`、`agent/error` 等事件语义；
- `@deepseek-ai/dsh-session` / `@deepseek-ai/dsh-session-title` / `@deepseek-ai/dsh-workspace` — `SessionHeader.cwd`、会话标题与工作区注册表。

ClaudeBell（前身，Claude Code hook 版）的实现保留在本仓库的 git 历史中，可用来对照通知渠道的原始设计。

-----

<a id="model-experience"></a>
## Model Experience

None — 本插件不注册任何工具、提示词片段或模型可见上下文，只旁听事件。

#### KV Cache effect

None；本插件不参与请求组装，也不改变请求前缀。

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

以下是当前实现的能力边界，不是待办清单。

- **桌面弹窗仅 Windows** — 卡片依赖 PowerShell + WinForms。其他平台 `sendDesktopNotification` 直接返回 `false` 并记日志，邮件渠道仍可用；`/notify-test` 会明确说明「当前平台不是 Windows」。
- **卡片不进截图与录屏** — 为了让毛玻璃实时跟随背景，窗口对截图 API 隐身（`WDA_EXCLUDEFROMCAPTURE`）。副作用是会议共享、录屏里看不到提醒。这是实时毛玻璃的必要代价，未提供开关。
- **定位信息仅对 live 会话可靠** — 工作区与对话标题来自 `sessions` 与 `sessionTitle` 的实时对象。会话不在 live 存储里（例如已归档，或宿主刚启动尚未恢复）时拿不到，插件安静降级为只显示事件细节，不会报错。
- **软链接安装不自带依赖** — DSH 用 pnpm `link:` 安装本地插件，插件目录里的依赖需要自己 `npm install`。这是安装「第 0 步」存在的原因，也是首次安装最常见的失败点。
- **改名或移动 Host 入口后需重启** — Node 按模块 URL 缓存；Host 进程一旦缓存过导入失败或旧路径，只有重启 DSH 桌面端才能清掉。
- **设置命名空间与 Loader 行 id 绑定** — 设置页读写的命名空间是 `notify-desktop`；改 `cordis.patch.yml` 里的 `id` 时必须同步改 `lib/client.js` 的 `ENTRY_ID`，否则设置页不会出现（`whileServed` 永远等不到该命名空间）。
- **单一通知形态** — 只有毛玻璃卡片一类，没有系统 Toast、托盘图标、网页推送或 webhook 转发；第二渠道固定为 SMTP 邮件。
- **界面文案以中文场景撰写** — 词典注册了 `zh` 与 `en`，但英文条目按中文语境直译，英文界面的可读性不做保证。
- **邮件为纯文本** — 不发送 HTML 邮件，也不附卡片截图（卡片本身对截图隐身，无法自证）。

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

以下维护者上下文不属于已发布契约；实际行为以代码与测试为准。

**`lib/popup.ps1` 必须保留 UTF-8 BOM。** Windows PowerShell 5.1 在没有 BOM 时按 ANSI 解码中文，会打乱 here-string 与注释，脚本直接起不来（`SyntaxError: Unexpected token '}'`），而且因为解析失败，连日志都不会写。`test/popup.test.mjs` 断言 BOM 与六个参数名，防止被编辑器「另存为 UTF-8」时悄悄丢掉。同理注意：PowerShell 5.1 的 `Set-Content -Encoding UTF8` 会**写入** BOM，用它改 `bin/` 下的脚本会把 `#!` 顶掉。

**`lib/client.js` 是手写模块，不是打包产物。** 约束：

- `id` 必须等于包名 `dsh-desktop-notification`（DSH 用包名作为浏览器模块 id）；
- 文件里只能有 `window.__ModuleLoader__.load({ id, factory })` 这一个顶层语句，其余全部放进 `factory`——启动时多个包会被拼进同一个 classic script，顶层声明会互相污染；
- 不能出现 `import` / `export`，改用 `require('react')`、`require('react/jsx-runtime')`、`require('@deepseek-ai/dsh-client-ui-primitives')`（都在平台 seed 表里，无需在 `dsh.client.external` 声明）；
- `factory` 必须 `return module.exports`。

**测试。** `npm test` 串行跑三组无浏览器检查：

| 文件 | 覆盖 |
|---|---|
| `test/popup.test.mjs` | 资源约定：BOM、参数名、不硬编码 logs 与 audio 目录、提示音存在 |
| `test/host.test.mjs` | 事件映射、去抖、子 Agent 过滤、审批与提问透传 `next()`、`/notify-test` 强制发送与失败归因、工作区与对话解析及降级、弹窗与邮件排版 |
| `test/client.test.mjs` | 设置页：`settings.section` 注册、中英文案键对齐、控件与写入路径、授权码角标、邮箱预设、服务器填错告警 |

Host 测试用最小 `ctx` 桩（`on` / `get` / `inject`）与三个假服务（`sessions`、`sessionTitle`、`workspaceRegistry`）；Client 测试用最小 React 桩（`useState` / `useCallback` / `useEffect` / `useSyncExternalStore`）把组件递归展开成元素树再断言，全程不打真实网络、不弹窗。

**手动验收配方。** 不动正在使用的实例：把 profile 复制成临时 profile（只复制 `package.json`、`cordis.patch.yml`、`cordis.yml`、lock 文件），在其中给插件建 junction，然后用桌面端自带的 CLI 启动（未加入 `PATH` 时用安装目录下的 `resources/runtime/cli/bin/dsh.cmd`）：

```powershell
dsh --profile <临时profile> --no-open --port 19391
```

观察两件事：控制台出现 `DSH 通知插件已加载：桌面通知=开，邮件=关`；首页 HTML 的 `window.__DSH_BOOT__` 里出现 `{"id":"dsh-desktop-notification","url":"plugins/??dsh-desktop-notification/client.js&rev=…"}`。验收完删掉临时 profile。

</details>

**Runtime invariant:** 通知链路上的任何失败都只写日志——不抛出、不改变审批结果、不阻塞对话流程。

## License

<a id="license"></a>

[MIT](LICENSE) © 2026 Changenming

本项目源自 ClaudeBell（Claude Code hook 版），其原始实现与本移植版同为 MIT 许可。
