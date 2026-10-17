// 临时冒烟测试：不开 DSH，用最小 ctx 桩验证 Host 半部的事件映射与去抖逻辑。
// 桌面/邮件都关掉，只断言「调度到了正确的事件类型」，不会弹窗。
// 不提交（tools/ 已进 .gitignore）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 日志写到系统临时目录，不污染仓库
const logDir = path.join(os.tmpdir(), 'dsh-notify-test');
fs.rmSync(logDir, { recursive: true, force: true });
process.env.DSH_NOTIFY_LOG_DIR = logDir;

const lines = [];
const realLog = console.log;
console.log = (...args) => {
  lines.push(args.join(' '));
};

const { apply, Config, name } = await import('../lib/index.js');

const assert = (ok, message) => {
  if (!ok) throw new Error(`FAIL: ${message}`);
  realLog(`ok - ${message}`);
};

assert(name === 'dsh-notify', '导出 name');
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
const ctx = {
  on: (event, handler) => {
    const list = listeners.get(event) ?? [];
    list.push(handler);
    listeners.set(event, list);
    return () => {};
  },
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
assert(dispatchLines()[0].includes('会话 a'), '通知里带上会话短码');

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

// 8) /notify-test 命令返回结果（桌面关 + 邮件关 → error 提示）
clearLines();
const result = await commands[0].handler({ rawInput: 'need_input', agent: { id: 'session-a' } });
assert(result.kind === 'error', '/notify-test 在没有可用渠道时返回 error');
assert(result.text.includes('没有任何渠道'), '/notify-test 给出可操作的提示');

// 9) 设置里改值立即生效（volatile 引用被 Loader 就地更新）
config.events.taskComplete = ref(false);
clearLines();
emit('agent/status', { agent: { id: 'session-b' }, status: 'running' });
emit('agent/status', { agent: { id: 'session-b' }, status: 'idle' });
await new Promise((resolve) => setTimeout(resolve, 20));
assert(dispatchLines().length === 0, '关掉「任务完成」后不再通知');

// 10) 日志确实落盘
await new Promise((resolve) => setTimeout(resolve, 50));
const written = fs.readdirSync(logDir).filter((f) => f.startsWith('dsh-notify-'));
assert(written.length >= 1, '日志写到了指定目录');

console.log = realLog;
realLog('\n全部通过');
