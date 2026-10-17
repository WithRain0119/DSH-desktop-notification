// 通知调度器：根据事件类型与设置，统一调度桌面弹窗与邮件通知
import logger from './logger.js';
import { sendDesktopNotification } from './desktop.js';
import { sendEmail } from './email.js';

/** 事件类型 → 通知标题 */
export const TITLES = {
  task_complete: 'DSH 任务完成',
  need_input: 'DSH 需要你的确认',
  error: 'DSH 任务出错',
};

/** 事件类型 → 缺省正文 */
export const DEFAULT_MESSAGES = {
  task_complete: '任务已完成，可以回来看看结果了',
  need_input: 'DSH 正在等待你的确认',
  error: '任务执行过程中出错',
};

/** 事件类型 → 设置里对应的开关字段 */
const EVENT_SWITCHES = {
  task_complete: 'taskComplete',
  need_input: 'needInput',
  error: 'error',
};

/** 弹窗正文/邮件标题里单个字段的最大字数，避免长标题把卡片撑爆 */
const MAX_LABEL_CHARS = 28;

/** 截断过长的标题，超出补省略号 */
function clip(value, max = MAX_LABEL_CHARS) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * 把「工作区 / 对话」压成一行，例如 `DSH-desktop-notification › 改设置页`。
 * 两者都没有时返回空串。
 * @param {{ workspace?: string, conversation?: string }} [target]
 */
export function formatTarget(target) {
  const parts = [clip(target?.workspace), clip(target?.conversation)].filter(Boolean);
  return parts.join(' › ');
}

/**
 * 组装弹窗正文：第一行写「哪个工作区 › 哪个对话」，后面才是事件细节。
 * 弹窗正文区域约 3 行，超出的部分交给弹窗自身裁剪。
 * @param {string} detail 事件细节（工具名、报错摘要等）
 * @param {{ workspace?: string, conversation?: string }} [target]
 */
export function popupBody(detail, target) {
  const where = formatTarget(target);
  return [where, detail].filter(Boolean).join('\n');
}

/** 邮件标题：`DSH 任务完成 · 工作区 › 对话` */
export function mailSubject(title, target) {
  const where = formatTarget(target);
  return where ? `${title} · ${where}` : title;
}

/** 邮件正文：结构化列出事件、工作区、对话、时间与会话 id */
export function mailBody(eventType, detail, target, now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const lines = [
    `事件：${TITLES[eventType] ?? eventType}`,
    `工作区：${target?.workspace || '（未知）'}`,
    `对话：${target?.conversation || '（未知）'}`,
    `时间：${time}`,
  ];
  if (target?.sessionId) lines.push(`会话：${target.sessionId}`);
  lines.push('', detail);
  return lines.join('\n');
}

/**
 * 该事件是否被设置允许通知（缺省值在 Host Config 里给了，这里只做兜底）。
 * @param {object} config 插件设置
 * @param {string} eventType 事件类型
 */
export function isEventEnabled(config, eventType) {
  const key = EVENT_SWITCHES[eventType];
  if (!key) return false;
  const events = config?.events ?? {};
  return events[key] !== false;
}

/**
 * 发送通知：按设置分别触发桌面弹窗与邮件。
 * 返回值说明每个渠道的实际结果，便于自测命令把「为什么没发」讲清楚。
 * 任何失败都只在内部记日志，不会 reject。
 * @param {string} eventType task_complete | need_input | error
 * @param {string} [message] 正文，缺省用默认文案
 * @param {object} [config] 插件设置快照
 * @param {{ force?: boolean, target?: { workspace?: string, conversation?: string, sessionId?: string } }} [options]
 *   force=true 时忽略「通知时机」开关（只给测试用）；target 标明工作区与对话
 * @returns {Promise<{
 *   title: string, message: string,
 *   desktop: boolean, mail: boolean,
 *   desktopEnabled: boolean, mailEnabled: boolean, mailFailed: boolean,
 *   eventEnabled: boolean, skipped: boolean,
 * }>}
 */
export async function notify(eventType, message, config = {}, options = {}) {
  const force = options.force === true;
  const target = options.target ?? {};
  const title = TITLES[eventType];
  const base = {
    title: '',
    message: '',
    desktop: false,
    mail: false,
    desktopEnabled: config?.desktop?.enabled !== false,
    mailEnabled: config?.mail?.enabled === true,
    mailFailed: false,
    eventEnabled: false,
    skipped: false,
  };
  if (!title) {
    logger.warn(`未知事件类型，忽略通知：${eventType}`);
    return base;
  }

  const text = String(message ?? '').trim() || DEFAULT_MESSAGES[eventType];
  const where = formatTarget(target);
  const eventEnabled = isEventEnabled(config, eventType);
  const result = { ...base, title, message: text, eventEnabled };

  logger.info(`通知调度开始: [${eventType}] ${title} - ${text}${where ? ` @ ${where}` : ''}`);

  if (!eventEnabled && !force) {
    logger.info(`事件 ${eventType} 的通知已在设置中关闭，跳过`);
    result.skipped = true;
    logger.info(`通知调度结束: [${eventType}]`);
    return result;
  }
  if (!eventEnabled) {
    logger.info(`事件 ${eventType} 在设置里是关闭的，但本次是测试通知，强制发送`);
  }

  if (result.desktopEnabled) {
    result.desktop = await sendDesktopNotification(title, popupBody(text, target), {
      timeoutSec: config?.desktop?.timeoutSec,
      sound: config?.desktop?.sound !== false,
    });
  } else {
    logger.info('桌面通知未开启，跳过');
  }

  if (result.mailEnabled) {
    result.mail = await sendEmail(config.mail, mailSubject(title, target), mailBody(eventType, text, target));
    result.mailFailed = result.mail === false;
  } else {
    logger.info('邮件通知未开启，跳过');
  }

  logger.info(`通知调度结束: [${eventType}]`);
  return result;
}

export default notify;
