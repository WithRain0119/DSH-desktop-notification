# dsh-desktop-notification

DeepSeek Harness（DSH）桌面/邮件通知插件：**任务完成**或**需要你确认**时，在屏幕右下角弹出毛玻璃卡片，也可以同时发一封邮件。

**不用一直盯着窗口了** —— DSH 在后台跑长任务时，你可以去干别的事：任务一结束，右下角弹卡片提醒；需要你点同意、或者 Agent 反过来提问时，也会提醒。打开邮件后手机也能收到推送。

> 本项目是 ClaudeBell（Claude Code hook 版）的 DSH 移植版：通知渠道、卡片外观、提示音、日志、邮件配置全部保留，只把触发源从 Claude Code 的 `Stop` / `Notification` hook 换成了 DSH 自己的 Agent 事件，并把配置搬进了 DSH 的设置界面。
>
> **命名**：包名是 `dsh-desktop-notification`，插件行 id / 设置命名空间是短名 `notify-desktop`。
> npm 上已经有别人的 `dsh-notify`、`dsh-notify-bell`、`dsh-notify-me` 等同类插件，特意不重名，避免在插件页按名字安装时装错。
> 顺便一句：那些插件都不支持邮件通知，这也是本项目保留自研的原因。

## 功能特性

- **桌面通知**：屏幕右下角弹出毛玻璃卡片，毛玻璃背景实时跟随背后画面；点击卡片任意位置关闭，默认 10 秒后自动消失；新通知会替换旧通知而不是堆叠
- **通知时机可分别开关**：任务完成 / 需要你确认 / 任务出错，三类事件独立控制
- **子 Agent 不打扰**：subagent、workflow 子任务结束时不弹窗（默认开启，可关）
- **邮件通知**：可选，默认关闭；可发到任意邮箱（包括自己发给自己）
- **图形化配置**：所有开关与 SMTP 参数都在 **设置 → 通知** 里改，改完立即生效，不需要改文件、不需要重启
- **按日期分割的日志**：所有事件、通知、错误都记录在 `DSH_HOME/logs/notify-desktop-YYYY-MM-DD.log`
- **无额外运行时依赖**：弹窗基于系统自带的 PowerShell + WinForms 自绘，不使用系统通知中心，也不需要安装通知组件
- **失败不外溢**：通知链路上的任何异常都只记日志，绝不影响 DSH 的对话流程；审批/提问监听只观察、不改变结果

## 环境要求

- DSH 桌面端（本插件在 DSH `0.2.0-rc.2` 上开发与验证）
- Windows 10/11（桌面弹窗依赖 PowerShell + WinForms；其他平台只能走邮件通知）
- Node.js 18+（仅自测脚本和依赖安装需要）

## 安装

### 第 0 步：先装插件自己的依赖

DSH 安装本地路径的插件时用的是 pnpm 的 `link:`（软链接），**不会**替你安装插件目录里的依赖：

```powershell
cd "E:\claude code\Project\DSH-desktop-notification"
npm install
```

这一步必须做，否则 Host 半部在 `import '@deepseek-ai/schemastery'` 处就会失败，
表现是插件页提示 `dsh-desktop-notification (notify-desktop): failed to import`。

### 方式一：在 DSH 里安装（推荐）

1. 打开 DSH 侧边栏的 **插件** 页 → **添加插件**；
2. 在包名输入框里填本目录的**绝对路径**，例如：

   ```
   E:\claude code\Project\DSH-desktop-notification
   ```

3. 点 **安装**。DSH 会把它作为 bundle 装进当前 profile（`dsh.profile.bundles` 增加 `dsh-desktop-notification`），并自动启用。

安装成功后打开 **设置 → 通知**，就能看到本插件的设置页。

> 如果插件页提示 `dsh-desktop-notification (notify-desktop): failed to import`，**重启一次 DSH 桌面端**再试：
> 插件代码在 Host 进程里按模块缓存，一次导入失败会被缓存到进程结束。

### 方式二：手动软链接（开发用）

```powershell
# 1) 把插件目录软链接进 profile 的 node_modules
$profile = "C:\Users\<你>\.dsh\profiles\desktop"
New-Item -ItemType Junction -Path "$profile\node_modules\dsh-desktop-notification" `
  -Target "E:\claude code\Project\DSH-desktop-notification"

# 2) 让 profile 选中这个 bundle（也可以直接在 DSH 插件页里启用）
#    $profile\package.json → dsh.profile.bundles 里加上 "dsh-desktop-notification"

# 3) 装插件自己的依赖
cd "E:\claude code\Project\DSH-desktop-notification"
npm install
```

> 插件自带的 `cordis.patch.yml` 会在 profile 里插入 `id: notify-desktop` 这一行；
> 这个 id 同时是设置界面里该插件的设置命名空间，不要改。

## 在设置界面里改配置

**侧边栏 → 设置 → 通知**（在 General / Models / Plugins 之后），页面分四组：

| 分组 | 项目 | 默认值 | 说明 |
| --- | --- | --- | --- |
| 桌面弹窗 | 启用桌面弹窗 | 开 | 总开关 |
|  | 播放提示音 | 开 | 弹窗出现时播放随包音效 |
|  | 自动消失（秒） | 10 | 点卡片可提前关闭 |
| 通知时机 | 任务完成 | 开 | 一轮对话结束、Agent 重新空闲时通知 |
|  | 需要你确认 | 开 | 工具审批、Agent 提问时通知 |
|  | 任务出错 | 关 | 某一轮或某一步出错时通知 |
|  | 忽略子 Agent | 开 | 只通知主会话 |
| 邮件通知 | 启用邮件通知 | 关 | 打开后每条通知同时发邮件 |
|  | SMTP 服务器 | — | 如 `smtp.qq.com` |
|  | 端口 | 587 | SSL 用 465，STARTTLS 用 587 |
|  | 使用 SSL | 关 | QQ / 163 / Gmail 选开 |
|  | SMTP 用户名 | — | 一般是完整邮箱地址 |
|  | SMTP 授权码 | — | **不是**邮箱登录密码；留空表示保持已保存的授权码 |
|  | 发件人 / 收件人 | — | 多数邮箱要求发件人 = SMTP 用户名；收件人填自己就是自己发给自己 |

所有改动都写进当前 profile 的 `cordis.patch.yml`（对应 `id: notify-desktop` 的 `config`），并立即生效。
SMTP 授权码字段标记为 `role('secret')`：它不会出现在设置文档的任何读取结果里，也不会写进日志。

### 邮件配置示例（QQ 邮箱）

1. 登录 QQ 邮箱 → 设置 → 账户 → 开启 **SMTP 服务**，拿到 **16 位授权码**；
2. 在 **设置 → 通知 → 邮件通知** 里填：

   ```
   SMTP 服务器   smtp.qq.com
   端口          465
   使用 SSL      开
   SMTP 用户名   你的QQ邮箱
   SMTP 授权码   你的16位授权码
   发件人        你的QQ邮箱
   收件人        你的QQ邮箱
   启用邮件通知   开
   ```

其他邮箱的服务器参数：

| 邮箱 | host | port | secure |
| --- | --- | --- | --- |
| QQ 邮箱 | `smtp.qq.com` | `465` | 开 |
| 163 邮箱 | `smtp.163.com` | `465` | 开 |
| Gmail | `smtp.gmail.com` | `465` | 开 |
| Outlook | `smtp.office365.com` | `587` | 关 |

## DSH 事件 → 通知

| DSH 事件 | 通知类型 | 触发时机 | 默认 |
| --- | --- | --- | --- |
| `agent/status`（`running` → `idle`） | 任务完成 | 一轮对话结束、Agent 重新空闲 | 开 |
| `approval/request` | 需要你确认 | 工具调用需要审批 | 开 |
| `user-questions/request` | 需要你确认 | Agent 调用 `ask_user_question` 向你提问 | 开 |
| `agent/error` | 任务出错 | 某一步或某一轮出错 | 关 |

实现细节：

- `agent/status` 只在**先 running 再 idle** 时通知，所以新建会话、恢复会话的空闲状态不会误报；
- 审批与提问是 waterfall 事件，插件只发通知、然后立刻 `next()`，**不参与决策**，不会改变审批结果或拖慢界面；
- `subagent/start` / `subagent/end` 用来记录子会话，`忽略子 Agent` 打开时这些会话结束不弹窗。

## 自测

### 在 DSH 里

在任意会话的输入框执行：

```
/notify-test
```

可选的参数：`/notify-test need_input`、`/notify-test error`。命令会按当前设置真的发一条通知，并告诉你走了哪些渠道。

### 不启动 DSH

```powershell
# 弹窗 + 提示音（默认「任务完成」文案）
node bin/dsh-notify-test.js test

# 其他文案 / 关闭提示音 / 5 秒后消失
node bin/dsh-notify-test.js test need_input
node bin/dsh-notify-test.js test --no-sound
node bin/dsh-notify-test.js test --timeout 5

# 连邮件一起测（读 SMTP_* / MAIL_* 环境变量）
$env:SMTP_HOST="smtp.qq.com"; $env:SMTP_PORT="465"; $env:SMTP_SECURE="true"
$env:SMTP_USER="你的邮箱"; $env:SMTP_PASS="授权码"
$env:MAIL_FROM="你的邮箱"; $env:MAIL_TO="你的邮箱"
node bin/dsh-notify-test.js test --mail
```

### 回归测试

```powershell
npm install
npm test
```

`test/host.test.mjs` 用假的 ctx 验证事件映射（running→idle 才通知、去抖、子 Agent 忽略、审批/提问透传 `next()`、出错默认关闭、设置改动立即生效、日志落盘）；
`test/client.test.mjs` 用最小的 React 桩验证设置页能注册、中英文案键对齐、8 个开关与 7 个输入框齐全、开关写到正确的设置路径。两者都不开浏览器、不弹窗。

## 日志

按日期分割，位于 DSH 主目录下：

```
C:\Users\<你>\.dsh\logs\notify-desktop-2026-10-17.log
```

- 日志目录由 `DSH_HOME`（默认 `~/.dsh`）推导；也可以用环境变量 `DSH_NOTIFY_LOG_DIR` 直接指定；
- Node 侧与弹窗（PowerShell）写同一个文件，`[popup]` 前缀的行来自弹窗进程，便于对照排查；
- SMTP 密码、授权码一律不写日志。

## 目录结构

```
DSH-desktop-notification/
├── package.json              # 插件清单：main / exports / dsh.client / dsh.bundle
├── cordis.patch.yml          # bundle 默认配置（插入 id: notify-desktop 的 Loader 行）
├── lib/
│   ├── host.js               # Host 半部：事件监听 → 通知调度（Config 也在这里）
│   ├── client.js             # Client 半部：注册「设置 → 通知」页面
│   ├── notify.js             # 通知调度器（事件类型 → 标题/文案，桌面 + 邮件）
│   ├── desktop.js            # 启动 popup.ps1（独立进程，脱离宿主进程树）
│   ├── email.js              # 邮件通知（nodemailer 懒加载）
│   ├── logger.js             # 按日期分割的日志
│   └── popup.ps1             # 自绘毛玻璃弹窗（PowerShell + WinForms）
├── assets/bell.mp3           # 提示音
├── bin/dsh-notify-test.js    # 命令行自测工具
└── test/                     # 无浏览器冒烟测试
```

## 常见问题

**Q：装完没有弹窗？**

1. 先确认 **设置 → 通知** 里「启用桌面弹窗」是开的；
2. 在输入框执行 `/notify-test`（或运行 `node bin/dsh-notify-test.js test`）：
   - **弹窗出现了** → 通知链路正常，问题在事件：确认「任务完成」开关是开的，并且这一轮真的结束了；
   - **还是没弹** → 看日志 `~/.dsh/logs/notify-desktop-<日期>.log`：
     - 有 `桌面弹窗已启动` 但没有 `[popup]` 开头的行 → 弹窗进程没起来（PowerShell 被策略拦截 / 被杀软拦）；
     - 有 `[popup] ERROR` → 弹窗脚本报错，行尾会带异常信息；
3. 如果插件页此前提示过 `failed to import`，重启 DSH 桌面端。

**Q：等了很久没反应，其实任务早就结束了？**
检查 Agent 是不是还在跑（可能卡在某个工具调用上）。通知只在 Agent **回到 idle** 时发；需要确认时会单独发「需要你确认」。

**Q：为什么会弹两次 / 只看到最后一条？**
连发多条通知时，新卡片会先关闭旧卡片再显示自己（否则旧卡片会被抓进新卡片的毛玻璃背景里，画面发灰）。所以短时间内连发，你只会看到最新的一张。

**Q：子 Agent 结束了也在弹？**
把 **设置 → 通知 → 忽略子 Agent** 打开（默认已开）。它是靠 `subagent/start` / `subagent/end` 记录子会话 id 来过滤的。

**Q：通知会出现在截图、录屏或会议共享里吗？**
不会。为了让毛玻璃背景实时跟随背后的画面，弹窗对截图 API 声明了隐藏（`WDA_EXCLUDEFROMCAPTURE`）：**人眼可见，但不会被截图/录屏/共享捕获**。这是实时毛玻璃的必要代价。

**Q：邮件发不出去？**

| 报错 | 原因 |
| --- | --- |
| `Invalid login: 535` | 用了邮箱登录密码，应改用 **SMTP 授权码** |
| `connect ETIMEDOUT` / `ECONNREFUSED` | 端口/加密方式选错（QQ/163 用 `465` + 开 SSL），或网络屏蔽了 SMTP |
| `Mail from must equal authorized user` | 发件人必须与 SMTP 用户名一致 |
| 日志显示发送成功但收不到 | 查垃圾邮件箱；换一个收件邮箱再试 |

**Q：授权码存在哪里？安全吗？**
存在当前 profile 的 `cordis.patch.yml`（`id: notify-desktop` 的 `config.mail.smtpPass`），文件权限跟随你的用户目录；插件把它标记为 secret：设置界面读不到明文，日志里也没有。

**Q：通知会拖慢 DSH 吗？**
不会。弹窗是独立进程，拉起即返回；邮件是异步的，失败只记日志。审批/提问监听同步返回 `next()`，不阻塞界面。

**Q：还能用原来的 `claude-bell` 命令吗？**
不需要了，hook 时代已经结束：事件来自 DSH 自己，配置在设置界面，自测用 `/notify-test` 或 `node bin/dsh-notify-test.js test`。旧的 CLI 代码保留在 git 历史里。

**Q：想换台机器 / 重装？**
删掉 profile 里的 `node_modules\dsh-desktop-notification` 与 `package.json` 的 `dsh.profile.bundles` 中的 `dsh-desktop-notification`，再重新安装即可。设置值存在 profile 的 `cordis.patch.yml` 里，卸载时可以把对应那段一起删掉。

## 卸载

1. 打开 **插件** 页，找到 `dsh-desktop-notification` → 卸载；
2. 或者手动：

   ```powershell
   $profile = "C:\Users\<你>\.dsh\profiles\desktop"
   # 从 $profile\package.json 的 dsh.profile.bundles 里删掉 "dsh-desktop-notification"
   Remove-Item "$profile\node_modules\dsh-desktop-notification" -Force
   # 顺手清掉 $profile\cordis.patch.yml 里 id: notify-desktop 的那段
   ```

## 开发须知

- **`lib/popup.ps1` 必须保存为 UTF-8 with BOM**。Windows PowerShell 5.1 在没有 BOM 时会按 ANSI 解码中文，导致 here-string 与中文注释解析错位，脚本直接起不来。
- 弹窗参数一律用 Base64 传（标题/正文），避免命令行中文编码问题。
- Host 半部的设置项全部是 schemastery `.volatile()`：只有 volatile 字段会出现在设置表单里，且改动只更新运行中的引用、不重载插件。
- Client 半部是手写的 `window.__ModuleLoader__.load({ id, factory })` 包（没有 TS 构建步骤）：`id` 必须是包名 `dsh-desktop-notification`，整个文件只能有这一个顶层语句，其余全部放在 `factory` 里。
- 插件的设置命名空间 = Loader 行 id = `notify-desktop`；改了 `cordis.patch.yml` 里的 id，就要同步改 `lib/client.js` 里的 `ENTRY_ID`。

## License

[MIT](LICENSE)
