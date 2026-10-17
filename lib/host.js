/**
 * DSH 桌面通知插件 · Host 半部
 *
 * 把 Claude Code 的 Stop / Notification hook 换成了 DSH 自己的 Agent 事件：
 *   - `agent/status` 由 running 变 idle  → 任务完成
 *   - `approval/request`                 → 需要你确认（工具审批）
 *   - `user-questions/request`           → 需要你确认（ask_user_question）
 *   - `agent/error`                      → 任务出错（默认关闭）
 *
 * 通知渠道与原项目一致：屏幕右下角的毛玻璃卡片（popup.ps1）+ 可选邮件 + 按日期分割的日志。
 */
import z from '@deepseek-ai/schemastery';
import logger from './logger.js';
import { notify, TITLES, DEFAULT_MESSAGES } from './notify.js';

/** cordis 插件名，与 npm 包名一致 */
export const name = 'dsh-desktop-notification';

/** 所有服务都是可选的：缺少审批/提问服务时插件照常工作 */
export const inject = [];

/**
 * 插件设置。每个叶子都标成 `.volatile()`：
 * 只有 volatile 字段会出现在 DSH 设置界面的表单里，并且改完立即生效、不需要重启。
 */
export const Config = z.object({
  desktop: z.object({
    enabled: z.boolean().default(true).volatile().description('任务完成或需要确认时，在屏幕右下角弹出毛玻璃通知卡片'),
    sound: z.boolean().default(true).volatile().description('弹窗出现时播放提示音'),
    timeoutSec: z.number().step(1).min(1).max(120).default(10).volatile().description('弹窗自动消失的秒数'),
  }),
  events: z.object({
    taskComplete: z.boolean().default(true).volatile().description('一轮对话结束时通知'),
    needInput: z.boolean().default(true).volatile().description('需要你确认（工具审批 / 提问）时通知'),
    error: z.boolean().default(false).volatile().description('任务出错时通知'),
  }),
  ignoreSubagents: z.boolean().default(true).volatile().description('忽略子 Agent（subagent / workflow）的结束，只通知主会话'),
  mail: z.object({
    enabled: z.boolean().default(false).volatile().description('同时发送邮件通知（默认关闭）'),
    smtpHost: z.string().default('').volatile().description('SMTP 服务器，例如 smtp.qq.com'),
    smtpPort: z.number().step(1).min(1).max(65535).default(587).volatile().description('SMTP 端口：465（SSL）或 587（STARTTLS）'),
    smtpSecure: z.boolean().default(false).volatile().description('是否使用 SSL 直连（QQ/163/Gmail 选是，端口 465）'),
    smtpUser: z.string().default('').volatile().description('SMTP 用户名（通常是完整邮箱地址）'),
    smtpPass: z.string().role('secret').default('').volatile().description('SMTP 授权码，不是邮箱登录密码'),
    from: z.string().default('').volatile().description('发件人地址，必须与 SMTP 用户名一致'),
    to: z.string().default('').volatile().description('收件人地址，填自己就是自己发给自己'),
  }),
});

/** 读一个可能是 volatile 引用的设置项 */
function valueOf(field, fallback) {
  if (field && typeof field.get === 'function') {
    const value = field.get();
    return value === undefined ? fallback : value;
  }
  return field === undefined ? fallback : field;
}

/** 取当前设置的纯对象快照（每次通知前现取，保证就是刚在设置界面改过的值） */
function snapshot(config) {
  const desktop = config?.desktop ?? {};
  const events = config?.events ?? {};
  const mail = config?.mail ?? {};
  return {
    desktop: {
      enabled: valueOf(desktop.enabled, true) !== false,
      sound: valueOf(desktop.sound, true) !== false,
      timeoutSec: Number(valueOf(desktop.timeoutSec, 10)) || 10,
    },
    events: {
      taskComplete: valueOf(events.taskComplete, true) !== false,
      needInput: valueOf(events.needInput, true) !== false,
      error: valueOf(events.error, false) === true,
    },
    ignoreSubagents: valueOf(config?.ignoreSubagents, true) !== false,
    mail: {
      enabled: valueOf(mail.enabled, false) === true,
      smtp: {
        host: valueOf(mail.smtpHost, ''),
        port: Number(valueOf(mail.smtpPort, 587)) || 587,
        secure: valueOf(mail.smtpSecure, false) === true,
        user: valueOf(mail.smtpUser, ''),
        pass: valueOf(mail.smtpPass, ''),
      },
      from: valueOf(mail.from, ''),
      to: valueOf(mail.to, ''),
    },
  };
}

/** 会话 id 短码：多条会话同时跑时便于区分 */
function shortSession(agent) {
  const id = String(agent?.id ?? '');
  return id ? id.replace(/^session-/, '').slice(0, 8) : '';
}

/**
 * Host 插件入口。
 * @param {object} ctx cordis 上下文
 * @param {object} config 解析后的插件设置（volatile 字段是 `.get()` 引用）
 */
export function apply(ctx, config) {
  /** running 中的会话：只在「真的跑过又停下来」时通知，避免新建会话的空闲也弹窗 */
  const running = new Set();
  /** 子 Agent 的会话 id：这些会话结束时默认不通知 */
  const children = new Set();

  const current = () => snapshot(config);

  /** 统一入口：异步发通知，任何异常都只记日志，绝不影响 DSH 自身流程 */
  const fire = (eventType, message) => {
    try {
      const settings = current();
      void Promise.resolve(notify(eventType, message, settings)).catch((err) => {
        logger.error(`通知发送异常（已忽略）：${err?.message || err}`);
      });
    } catch (err) {
      logger.error(`通知调度异常（已忽略）：${err?.message || err}`);
    }
  };

  // ---- 子 Agent 记录：默认不通知它们 ----
  ctx.on('subagent/start', (info) => {
    const id = info?.id ?? info?.sessionId;
    if (id) children.add(String(id));
  });
  ctx.on('subagent/end', (info) => {
    const id = info?.id ?? info?.sessionId;
    if (id) children.delete(String(id));
  });

  // ---- 任务完成：agent 由 running 变 idle ----
  ctx.on('agent/status', ({ agent, status } = {}) => {
    const id = String(agent?.id ?? '');
    if (!id) return;
    if (status === 'running') {
      running.add(id);
      return;
    }
    // 没有先 running 过的 idle（新建会话、恢复会话）不通知
    if (!running.delete(id)) return;

    const settings = current();
    if (!settings.events.taskComplete) {
      logger.info('任务完成通知已在设置中关闭，跳过');
      return;
    }
    if (settings.ignoreSubagents && children.has(id)) {
      logger.info(`忽略子 Agent 会话结束：${id}`);
      return;
    }
    const short = shortSession(agent);
    const message = short ? `${DEFAULT_MESSAGES.task_complete}（会话 ${short}）` : DEFAULT_MESSAGES.task_complete;
    fire('task_complete', message);
  });

  // ---- 需要确认：工具审批 ----
  ctx.on('approval/request', (request, next) => {
    try {
      if (current().events.needInput) {
        const tool = request?.toolName ? `工具 ${request.toolName}` : '有一个操作';
        const reason = request?.displayReason?.zh ?? request?.displayReason?.en ?? request?.reason ?? '';
        const message = reason ? `${tool} 等你确认：${reason}` : `${tool} 等你确认后才能继续`;
        fire('need_input', message);
      }
    } catch (err) {
      logger.error(`审批通知异常（已忽略）：${err?.message || err}`);
    }
    // 只观察，不改变审批结果
    return next();
  });

  // ---- 需要确认：向用户提问 ----
  ctx.on('user-questions/request', (request, next) => {
    try {
      if (current().events.needInput) {
        const first = request?.questions?.[0];
        const asked = first?.header || first?.question;
        fire('need_input', asked ? `DSH 想问你：${asked}` : DEFAULT_MESSAGES.need_input);
      }
    } catch (err) {
      logger.error(`提问通知异常（已忽略）：${err?.message || err}`);
    }
    return next();
  });

  // ---- 任务出错 ----
  ctx.on('agent/error', ({ agent, error } = {}) => {
    const settings = current();
    if (!settings.events.error) return;
    const id = String(agent?.id ?? '');
    if (settings.ignoreSubagents && id && children.has(id)) return;
    const detail = error?.message || String(error ?? '');
    fire('error', detail ? `任务出错：${detail.slice(0, 120)}` : DEFAULT_MESSAGES.error);
  });

  // ---- /notify-test：手动发一条测试通知（相当于原 CLI 的 test 命令）----
  ctx.inject(['commands'], (child) => {
    child.effect(() => child.commands.register({
      name: 'notify-test',
      description: '发送一条 DSH 桌面/邮件测试通知',
      input: { hint: 'task_complete | need_input | error（留空=任务完成）' },
      handler: async (invocation) => {
        const raw = String(invocation?.rawInput ?? '').trim();
        const eventType = Object.hasOwn(TITLES, raw) ? raw : 'task_complete';
        const settings = current();
        const result = await notify(eventType, '这是一条 DSH 通知测试', settings);
        const channels = [result.desktop ? '桌面弹窗' : null, result.mail ? '邮件' : null].filter(Boolean);
        if (!channels.length) {
          return {
            kind: 'error',
            text: '没有任何渠道发出通知：请检查「设置 → 通知」里的桌面 / 邮件开关与 SMTP 配置（日志见 DSH_HOME/logs）。',
          };
        }
        return { kind: 'success', text: `测试通知已发送（${channels.join(' + ')}，事件 ${eventType}）。` };
      },
    }), 'notify-desktop: /notify-test');
  });

  logger.info(`DSH 通知插件已加载：桌面通知=${current().desktop.enabled ? '开' : '关'}，邮件=${current().mail.enabled ? '开' : '关'}`);
}

export default { name, inject, Config, apply };
