// 资源约定检查：popup.ps1 的编码与参数、提示音文件。
//
// popup.ps1 必须带 UTF-8 BOM：Windows PowerShell 5.1 在没有 BOM 时会按 ANSI
// 解码中文，导致 here-string 与注释解析错位，脚本直接起不来（实测踩过）。
// 这条测试用来防止哪天被编辑器「另存为 UTF-8」时悄悄丢掉 BOM。
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const assert = (ok, message) => {
  if (!ok) throw new Error(`FAIL: ${message}`);
  console.log(`ok - ${message}`);
};

const popupPath = fileURLToPath(new URL('../lib/popup.ps1', import.meta.url));
const bytes = fs.readFileSync(popupPath);
const text = fs.readFileSync(popupPath, 'utf8');

assert(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, 'popup.ps1 带 UTF-8 BOM');

// Node 侧传的参数必须都被 popup.ps1 声明，否则弹窗会静默丢参数
for (const name of ['TitleB64', 'MessageB64', 'TimeoutSec', 'LogFile', 'AudioPath', 'Sound']) {
  assert(new RegExp(`\\$${name}`).test(text), `popup.ps1 声明参数 ${name}`);
}

// 弹窗不应再硬编码日志/音效路径：路径由 Host 传进来（安装后包目录是只读的）
assert(!text.includes("'..\\..\\logs'"), 'popup.ps1 不再硬编码 logs 目录');
assert(!text.includes("'..\\..\\audio'"), 'popup.ps1 不再硬编码 audio 目录');

// 中文文案要能正常解码（BOM + UTF-8）：抽查几处关键字
for (const needle of ['毛玻璃', '提示音', '弹窗进程启动']) {
  assert(text.includes(needle), `popup.ps1 中文完好：${needle}`);
}

// 提示音随包分发
const audioPath = fileURLToPath(new URL('../assets/bell.mp3', import.meta.url));
const audio = fs.statSync(audioPath);
assert(audio.size > 1024, 'assets/bell.mp3 存在且非空');

console.log('\n全部通过');
