// 邮件通知：使用 nodemailer 发送邮件，默认关闭，需在设置里开启
// nodemailer 是可选依赖：懒加载，没装 nodemailer 时插件仍能正常加载（只是发不了邮件）
import logger from './logger.js';

/** 缓存 nodemailer 模块（首次发邮件时才真正加载） */
let nodemailer;
/** 上一次加载失败的原因，避免每次通知都重复报同一个错 */
let loadError = '';

/** 懒加载 nodemailer，返回模块或 undefined */
async function loadNodemailer() {
  if (nodemailer) return nodemailer;
  try {
    const mod = await import('nodemailer');
    nodemailer = mod.default ?? mod;
    loadError = '';
    return nodemailer;
  } catch (err) {
    const reason = err?.message || String(err);
    if (reason !== loadError) {
      loadError = reason;
      logger.error(`邮件通知不可用：无法加载 nodemailer（${reason}）。请在插件目录执行 npm install 后重试`);
    }
    return undefined;
  }
}

/**
 * 发送邮件通知，失败只记日志不影响调用方。
 * @param {{ smtp?: {host?: string, port?: number, secure?: boolean, user?: string, pass?: string}, from?: string, to?: string }} mail
 * @param {string} subject 主题
 * @param {string} text 正文
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendEmail(mail, subject, text) {
  const smtp = mail?.smtp ?? {};
  const from = mail?.from ?? '';
  const to = mail?.to ?? '';

  // 必要配置缺失时直接报错返回，避免无意义的连接尝试
  if (!smtp.host || !from || !to) {
    logger.error('邮件配置不完整（需要 SMTP 服务器、发件人、收件人），跳过发送');
    return false;
  }

  const mailer = await loadNodemailer();
  if (!mailer) return false;

  const transport = mailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: smtp.secure === true,
    // 有用户名才启用认证（密码只进 SMTP，不写日志）
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  try {
    const info = await transport.sendMail({ from, to, subject, text });
    logger.info(`邮件已发送：${subject} -> ${to}（${info.messageId}）`);
    return true;
  } catch (err) {
    logger.error(`邮件发送失败（${smtp.host}:${smtp.port}）：${err.message || err}`);
    return false;
  }
}

export default sendEmail;
