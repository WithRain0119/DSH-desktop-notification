// 日志模块：同时输出到控制台和文件，按日期分割日志文件
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 补零：保证两位数 */
const pad = (n) => String(n).padStart(2, '0');

/** 格式化时间戳：YYYY-MM-DD HH:MM:SS */
function formatTime(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * 日志目录：优先 DSH_NOTIFY_LOG_DIR，其次 DSH_HOME/logs，最后 ~/.dsh/logs。
 * 不写在插件包内部 —— 安装后的 node_modules 目录不应被写入。
 */
export function resolveLogDir() {
  if (process.env.DSH_NOTIFY_LOG_DIR) return path.resolve(process.env.DSH_NOTIFY_LOG_DIR);
  if (process.env.DSH_HOME) return path.join(path.resolve(process.env.DSH_HOME), 'logs');
  return path.join(os.homedir(), '.dsh', 'logs');
}

/** 当天日志文件路径（popup.ps1 也用同一个文件，方便对照排查） */
export function currentLogFile() {
  return path.join(resolveLogDir(), `dsh-notify-${formatTime(new Date()).slice(0, 10)}.log`);
}

/** 写一条日志：控制台 + 当天日志文件，写文件失败绝不影响通知主流程 */
function log(level, msg) {
  if (level === 'ERROR' && msg instanceof Error) msg = msg.stack || msg.message;
  const time = formatTime(new Date());
  const line = `[${time}] [${level}] ${msg}`;
  try {
    console.log(line);
  } catch {
    /* 控制台不可用（无 TTY）时忽略 */
  }
  try {
    const file = currentLogFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, line + '\n', 'utf8');
  } catch {
    /* 日志目录不可写时忽略：日志不能反过来把通知搞挂 */
  }
}

export const logger = {
  log,
  info: (msg) => log('INFO', msg),
  warn: (msg) => log('WARN', msg),
  error: (msg) => log('ERROR', msg),
  debug: (msg) => log('DEBUG', msg),
};

export default logger;
