// 临时冒烟测试：不开 DSH，用最小 ctx 桩验证 Host 半部的事件映射与去抖逻辑。
// 桌面/邮件都关掉，只断言「调度到了正确的事件类型」，不会弹窗。
// 不提交（tools/ 已进 .gitignore）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 日志写到系统临时目录，不污染仓库
const logDir = path.join(os.tmpdir(), 'notify-desktop-test');
fs.rmSync(logDir, { recursive: true, force: true });
process.env.DSH_NOTIFY_LOG_DIR = logDir;

const lines = [];
const realLog = console.log;
console.log = (...args) => {
  lines.push(args.join(' '));
};

const { apply, Config, name } = await import('../lib/host.js');

const assert = (ok, message) => {
  if (!ok) throw new Error(`FAIL: ${message}`);
  realLog(`ok - ${message}`);
};

assert(name === 'dsh-desktop-notification', '导出 name');
assert(!!Config && typeof Config === 'function', '导出 Config schema');

// 设置对象：volatile 字段在运行期是 { get() } 引用
const ref = (value) => ({ get: () => value });
const config = {
  desktop: { enabled: ref(false), sound: ref(true), timeoutSec: ref(10) },
  events: { taskComplete: ref(true), needInput: ref(true), error: ref(false) },
  ignoreSubagents: ref(true),
  mail: {
    enabled: ref(false),
    smtpHost: ref(''),
    smtpPort: ref(587),
    smtpSecure: ref(false),
    smtpUser: ref(''),
    smtpPass: ref(''),
    from: ref(''),
    to: ref(''),
  },
};

// ---- 最小 ctx 桩 ----
const listeners = new Map();
const commands = [];
let nestedCalls = 0;

// 会话 / 工作区 / 标题：模拟 Host 的 sessions、workspaceRegistry、sessionTitle 三个服务
const CWD = 'E:\\claude code\\Project\\DSH-desktop-notification';
const sessionsById = new Map([
  ['session-a', { id: 'session-a', header: { cwd: CWD } }],
  ['session-b', { id: 'session-b', header: { cwd: CWD } }],
  ['session-quiet', { id: 'session-quiet', header: { cwd: 'E:\\somewhere\\unknown-project' } }],
]);
const titles = new Map([
  ['session-a', { title: '改插件设置页' }],
  ['session-b', { title: '别的对话' }],
]);
const services = {
  sessions: { get: (id) => sessionsById.get(id) },
  sessionTitle: { get: (session) => titles.get(session?.id) },
  workspaceRegistry: {
    list: () => [
      // 这台机器上真实的工作区标题就是文件夹名
      { id: 'ws-1', path: CWD, title: 'DSH-desktop-notification', sessionIds: ['session-a', 'session-b'] },
    ],
  },
};

const ctx = {
  on: (event, handler) => {
    const list = listeners.get(event) ?? [];
    list.push(handler);
    listeners.set(event, list);
    return () => {};
  },
  get: (key) => services[key],
  inject: (_deps, callback) => {
    nestedCalls += 1;
    callback({
      effect: (fn) => fn(),
      commands: {
        register: (definition) => {
          commands.push(definition);
          return () => {};
        },
      },
    });
    return () => {};
  },
};

const emit = (event, payload) => {
  const list = listeners.get(event) ?? [];
  return list.map((handler) => handler(payload));
};

apply(ctx, config);

assert(listeners.has('agent/status'), '监听 agent/status');
assert(listeners.has('approval/request'), '监听 approval/request');
assert(listeners.has('user-questions/request'), '监听 user-questions/request');
assert(listeners.has('agent/error'), '监听 agent/error');
assert(nestedCalls === 1 && commands.length === 1, '注册了 /notify-test 命令');
assert(commands[0].name === 'notify-test', '命令名为 notify-test');

const clearLines = () => {
  lines.length = 0;
};
const dispatchLines = () => lines.filter((line) => line.includes('通知调度开始'));

// 1) 新建会话直接 idle：不应通知
clearLines();
emit('agent/status', { agent: { id: 'session-new' }, status: 'idle' });
assert(dispatchLines().length === 0, '没有先 running 的 idle 不通知');

// 2) running → idle：任务完成
clearLines();
emit('agent/status', { agent: { id: 'session-a' }, status: 'running' });
emit('agent/status', { agent: { id: 'session-a' }, status: 'idle' });
await new Promise((resolve) => setTimeout(resolve, 20));
assert(dispatchLines().length === 1 && dispatchLines()[0].includes('[task_complete]'), 'running → idle 通知任务完成');
assert(
  dispatchLines()[0].includes('@ DSH-desktop-notification › 改插件设置页'),
  '通知标注了工作区 › 对话（而不是看不懂的会话短码）',
);

// 3) 重复 idle：不重复通知
clearLines();
emit('agent/status', { agent: { id: 'session-a' }, status: 'idle' });
await new Promise((resolve) => setTimeout(resolve, 20));
assert(dispatchLines().length === 0, '同一个 idle 不会重复通知');

// 4) 子 Agent：默认忽略
clearLines();
emit('subagent/start', { id: 'session-child', provider: 'spawn' });
emit('agent/status', { agent: { id: 'session-child' }, status: 'running' });
emit('agent/status', { agent: { id: 'session-child' }, status: 'idle' });
await new Promise((resolve) => setTimeout(resolve, 20));
assert(dispatchLines().length === 0, '子 Agent 结束不通知');

// 5) 审批：只观察、不改变结果
clearLines();
let nextCalled = 0;
const outcomes = await Promise.all(
  (listeners.get('approval/request') ?? []).map((handler) =>
    handler({ agent: { id: 'session-a' }, toolName: 'bash', reason: 'rm -rf build' }, () => {
      nextCalled += 1;
      return Promise.resolve('allowed-once');
    }),
  ),
);
await new Promise((resolve) => setTimeout(resolve, 20));
assert(nextCalled === 1, '审批监听调用了 next()（不拦截）');
assert(outcomes[0] === 'allowed-once', '透传下一个审批处理器的结果');
assert(dispatchLines().length === 1 && dispatchLines()[0].includes('[need_input]'), '审批触发「需要确认」通知');
assert(lines.some((line) => line.includes('工具 bash')), '通知正文带上工具名');

// 6) 提问：同一次对话里只发一条
clearLines();
let questionNext = 0;
await Promise.all(
  (listeners.get('user-questions/request') ?? []).map((handler) =>
    handler(
      { questions: [{ header: '方案选择', question: '要哪个？' }] },
      () => {
        questionNext += 1;
        return Promise.resolve({ answers: [] });
      },
    ),
  ),
);
await new Promise((resolve) => setTimeout(resolve, 20));
assert(questionNext === 1, '提问监听调用了 next()');
assert(dispatchLines().length === 1 && dispatchLines()[0].includes('[need_input]'), '提问触发「需要确认」通知');
assert(lines.some((line) => line.includes('方案选择')), '通知正文带上问题标题');

// 7) 出错事件默认关闭
clearLines();
emit('agent/error', { agent: { id: 'session-a' }, error: new Error('boom') });
await new Promise((resolve) => setTimeout(resolve, 20));
assert(dispatchLines().length === 0, '出错通知默认关闭');

// 8) /notify-test：不受「通知时机」开关限制（这是 error 事件被用户测出问题的那个缺陷）
//    桌面与邮件都关着，所以没渠道 → error；但必须走到调度，日志里要留下「强制发送」。
clearLines();
const result = await commands[0].handler({ rawInput: 'error', agent: { id: 'session-a' } });
assert(result.kind === 'error', '/notify-test 在没有可用渠道时返回 error');
assert(result.text.includes('「启用桌面弹窗」是关的'), '提示里点名是哪个开关关着');
assert(
  lines.some((line) => line.includes('强制发送')),
  '/notify-test 对已关闭的事件类型仍然强制发送（不再被 events.error 拦住）',
);
assert(dispatchLines().length === 1 && dispatchLines()[0].includes('[error]'), '/notify-test error 走到了 error 分支');
assert(
  dispatchLines()[0].includes('@ DSH-desktop-notification › 改插件设置页'),
  '/notify-test 也标注当前工作区 › 对话',
);

// 8b) 目录不属于任何注册工作区：退回文件夹名，且没有对话标题时不硬凑
clearLines();
emit('agent/status', { agent: { id: 'session-quiet' }, status: 'running' });
emit('agent/status', { agent: { id: 'session-quiet' }, status: 'idle' });
await new Promise((resolve) => setTimeout(resolve, 20));
assert(
  dispatchLines().length === 1 && dispatchLines()[0].includes('@ unknown-project'),
  '未注册的目录退回文件夹名',
);
assert(!dispatchLines()[0].includes('›'), '没有对话标题时不输出空的「›」');

// 8b2) 连会话都查不到：完全不加标注，也不报错
clearLines();
emit('agent/status', { agent: { id: 'session-missing' }, status: 'running' });
emit('agent/status', { agent: { id: 'session-missing' }, status: 'idle' });
await new Promise((resolve) => setTimeout(resolve, 20));
assert(dispatchLines().length === 1 && !dispatchLines()[0].includes('@'), '信息全无时安静降级，不留 @ 尾巴');

// 8c) 通知正文/邮件的排版（纯函数，直接断言）
{
  const { popupBody, mailSubject, mailBody } = await import('../lib/notify.js');
  const target = { workspace: 'DSH-desktop-notification', conversation: '改插件设置页', sessionId: 'session-a' };
  assert(
    popupBody('工具 bash 等你确认', target) === 'DSH-desktop-notification › 改插件设置页\n工具 bash 等你确认',
    '弹窗正文：第一行工作区 › 对话，第二行事件细节',
  );
  assert(
    mailSubject('DSH 任务完成', target) === 'DSH 任务完成 · DSH-desktop-notification › 改插件设置页',
    '邮件标题带上工作区与对话',
  );
  const body = mailBody('task_complete', '任务已完成', target, new Date(2026, 9, 17, 13, 20, 0));
  assert(body.includes('工作区：DSH-desktop-notification') && body.includes('对话：改插件设置页'), '邮件正文列出工作区与对话');
  assert(body.includes('时间：2026-10-17 13:20:00'), '邮件正文带时间');
  assert(!body.includes('session-a'), '邮件正文不带会话 id（长串对人没意义）');
  assert(popupBody('只有细节', undefined) === '只有细节', '没有 target 时弹窗正文保持原文');
}

// 9) 设置里改值立即生效（volatile 引用被 Loader 就地更新）
config.events.taskComplete = ref(false);
clearLines();
emit('agent/status', { agent: { id: 'session-b' }, status: 'running' });
emit('agent/status', { agent: { id: 'session-b' }, status: 'idle' });
await new Promise((resolve) => setTimeout(resolve, 20));
assert(dispatchLines().length === 0, '关掉「任务完成」后不再通知');

// 10) 正式事件仍然尊重开关：error 关着时 agent/error 不调度
clearLines();
emit('agent/error', { agent: { id: 'session-b' }, error: new Error('boom') });
await new Promise((resolve) => setTimeout(resolve, 20));
assert(dispatchLines().length === 0, '正式事件仍受开关约束（force 只给测试用）');

// 10) 日志确实落盘
await new Promise((resolve) => setTimeout(resolve, 50));
const written = fs.readdirSync(logDir).filter((f) => f.startsWith('notify-desktop-'));
assert(written.length >= 1, '日志写到了指定目录');

console.log = realLog;
realLog('\n全部通过');
