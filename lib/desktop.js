// 桌面通知：调用自绘弹窗脚本 popup.ps1（PowerShell + WinForms），在屏幕右下角显示提示窗口
// 不走系统通知中心（snoretoast 在本机被系统禁用，且本项目要求自绘窗口）
//
// 用 `cmd /c start /b` 而非直接 spawn：直接 spawn 的子进程会在父进程退出时被终止。
// Host 进程虽然长期存活，但用 start 让弹窗彻底脱离进程树更稳妥（弹窗被关掉也不影响 Host）。
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger, { currentLogFile } from './logger.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** 自绘弹窗脚本 */
const popupScript = path.join(here, 'popup.ps1');
/** 提示音（mp3，随包分发） */
const audioPath = path.join(here, '..', 'assets', 'bell.mp3');

/** 中文/特殊字符用 Base64 传参，避免命令行编码问题（popup.ps1 内部解码） */
const b64 = (text) => Buffer.from(String(text ?? ''), 'utf8').toString('base64');

/**
 * 发送桌面弹窗：启动独立进程显示窗口，窗口成功拉起即视为发送成功。
 * @param {string} title 弹窗标题
 * @param {string} message 弹窗正文
 * @param {{ timeoutSec?: number, sound?: boolean }} [options]
 * @returns {Promise<boolean>} 是否成功拉起弹窗进程
 */
export function sendDesktopNotification(title, message, options = {}) {
  const timeoutSec = Number.isFinite(options.timeoutSec) ? Math.max(1, Math.trunc(options.timeoutSec)) : 10;
  const sound = options.sound !== false;

  if (process.platform !== 'win32') {
    logger.warn(`当前平台 ${process.platform} 不支持自绘桌面弹窗，跳过（仅 Windows 已适配）`);
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const args = [
      '/c', 'start', '""', '/b',
      'powershell.exe',
      '-NoProfile',
      '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass',
      '-File', popupScript,
      '-TitleB64', b64(title),
      '-MessageB64', b64(message),
      '-TimeoutSec', String(timeoutSec),
      '-LogFile', currentLogFile(),
      '-AudioPath', audioPath,
      '-Sound', sound ? '1' : '0',
    ];

    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    try {
      const child = spawn('cmd.exe', args, {
        stdio: 'ignore',
        windowsHide: true, // 隐藏 cmd 控制台窗口，只显示弹窗本身
      });
      child.on('error', (err) => {
        logger.error(`桌面弹窗启动失败：${err.message || err}`);
        done(false);
      });
      child.on('exit', (code) => {
        // start 命令本身立即返回，这里只说明拉起成功；弹窗生命周期由 popup.ps1 自行管理
        if (code === 0) {
          logger.info(`桌面弹窗已启动：${title} - ${message}`);
          done(true);
        } else {
          logger.error(`桌面弹窗启动失败：start 退出码 ${code}`);
          done(false);
        }
      });
    } catch (err) {
      logger.error(`桌面弹窗启动异常：${err.message || err}`);
      done(false);
    }
  });
}

export default sendDesktopNotification;
