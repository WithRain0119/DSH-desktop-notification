#!/usr/bin/env node
/**
 * dsh-notify 命令行自测工具（相当于原 ClaudeBell 的 `claude-bell test`）。
 *
 * 它不读取 DSH 的设置，只用命令行参数，用来在 DSH 之外快速验证：
 *   - 弹窗能不能正常显示（popup.ps1 / 提示音 / 毛玻璃）
 *   - 邮件配置是否可用
 *   - 日志写到哪里
 *
 * 用法：
 *   node bin/dsh-notify.js test                    # 任务完成 文案
 *   node bin/dsh-notify.js test need_input         # 需要确认 文案
 *   node bin/dsh-notify.js test error              # 出错 文案
 *   node bin/dsh-notify.js test --no-sound         # 不播放提示音
 *   node bin/dsh-notify.js test --timeout 5        # 卡片 5 秒后消失
 *   node bin/dsh-notify.js test --mail             # 同时发邮件（读 SMTP_* 环境变量）
 */
import { notify, TITLES } from '../lib/notify.js';
import { currentLogFile, resolveLogDir } from '../lib/logger.js';

const USAGE = `dsh-notify — DSH 通知插件自测工具

用法:
  node bin/dsh-notify.js test [事件类型] [选项]

事件类型:
  task_complete   任务完成（默认）
  need_input      需要你确认
  error           任务出错

选项:
  --no-sound            不播放提示音
  --timeout <秒>        卡片停留秒数（默认 10）
  --mail                同时发送邮件，需要这些环境变量：
                        SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS MAIL_FROM MAIL_TO
  --message <文本>      自定义通知正文
  -h, --help            显示本帮助

日志目录: ${resolveLogDir()}
`;

/** 读取 `--key value` 形式的参数 */
function flagValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

/** 从环境变量拼出邮件设置 */
function mailFromEnv() {
  return {
    enabled: true,
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: (process.env.SMTP_SECURE ?? '').toLowerCase() === 'true',
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
    from: process.env.MAIL_FROM ?? '',
    to: process.env.MAIL_TO ?? '',
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help') || argv[0] !== 'test') {
    console.log(USAGE);
    process.exit(0);
  }

  const eventType = Object.hasOwn(TITLES, argv[1]) ? argv[1] : 'task_complete';
  const sound = !argv.includes('--no-sound');
  const timeout = Number(flagValue(argv, '--timeout') ?? 10);
  const message = flagValue(argv, '--message') ?? '这是一条 dsh-notify 测试通知';
  const withMail = argv.includes('--mail');

  const config = {
    desktop: { enabled: true, sound, timeoutSec: Number.isFinite(timeout) ? timeout : 10 },
    events: { taskComplete: true, needInput: true, error: true },
    mail: withMail ? mailFromEnv() : { enabled: false },
  };

  const result = await notify(eventType, message, config);
  console.log(`\n事件: ${eventType}  标题: ${result.title}`);
  console.log(`桌面弹窗: ${result.desktop ? '已发送' : '未发送'}`);
  console.log(`邮件通知: ${withMail ? (result.mail ? '已发送' : '未发送（检查 SMTP_* 环境变量）') : '未开启'}`);
  console.log(`日志文件: ${currentLogFile()}`);
  if (!result.desktop && process.platform !== 'win32') {
    console.log('\n提示: 桌面弹窗当前只适配 Windows，其他平台只会走邮件通知。');
  }
}

main().catch((err) => {
  console.error(`测试通知发送失败: ${err?.message || err}`);
  process.exitCode = 1;
});
