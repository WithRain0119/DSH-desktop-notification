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
 * 返回 Promise，便于调用方等待通知发完；任何失败都只在内部记日志，不会 reject。
 * @param {string} eventType task_complete | need_input | error
 * @param {string} [message] 正文，缺省用默认文案
 * @param {object} [config] 插件设置快照
 * @returns {Promise<{ title: string, message: string, desktop: boolean, mail: boolean }>}
 */
export async function notify(eventType, message, config = {}) {
  const title = TITLES[eventType];
  if (!title) {
    logger.warn(`未知事件类型，忽略通知：${eventType}`);
    return { title: '', message: '', desktop: false, mail: false };
  }
  const text = String(message ?? '').trim() || DEFAULT_MESSAGES[eventType];
  const result = { title, message: text, desktop: false, mail: false };

  logger.info(`通知调度开始: [${eventType}] ${title} - ${text}`);

  if (!isEventEnabled(config, eventType)) {
    logger.info(`事件 ${eventType} 的通知已在设置中关闭，跳过`);
    logger.info(`通知调度结束: [${eventType}]`);
    return result;
  }

  const desktop = config?.desktop ?? {};
  if (desktop.enabled !== false) {
    result.desktop = await sendDesktopNotification(title, text, {
      timeoutSec: desktop.timeoutSec,
      sound: desktop.sound !== false,
    });
  } else {
    logger.info('桌面通知未开启，跳过');
  }

  const mail = config?.mail ?? {};
  if (mail.enabled === true) {
    result.mail = await sendEmail(mail, title, text);
  } else {
    logger.info('邮件通知未开启，跳过');
  }

  logger.info(`通知调度结束: [${eventType}]`);
  return result;
}

export default notify;
