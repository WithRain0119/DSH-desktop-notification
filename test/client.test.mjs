// 临时冒烟测试：不开浏览器，用最小 React/宿主桩把 lib/client.js 跑一遍。
// 目的：验证页面能构建、控件能绑定到正确的设置路径、文案键不缺失。
// 不提交（tools/ 已进 .gitignore）。
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8');

const loaded = [];
const fakeWindow = { __ModuleLoader__: { load: (reg) => loaded.push(reg) } };

// ---- 最小 React 桩 ----
const reactStub = {
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useEffect: () => {},
  useRef: (v) => ({ current: v }),
  useSyncExternalStore: (_sub, get) => get(),
};
const jsx = (type, props) => ({ type, props: props ?? {} });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' };
const primitivesStub = {
  Switch: (props) => ({ type: 'Switch', props }),
  Button: (props) => ({ type: 'Button', props }),
};
const requireStub = (spec) => {
  if (spec === 'react') return reactStub;
  if (spec === 'react/jsx-runtime') return jsxRuntime;
  if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub;
  throw new Error(`unexpected require: ${spec}`);
};

// eslint-disable-next-line no-new-func
new Function('window', 'require', src)(fakeWindow, requireStub);
if (loaded.length !== 1) throw new Error(`expected 1 registration, got ${loaded.length}`);
const registration = loaded[0];
if (registration.id !== 'dsh-desktop-notification') throw new Error(`bad id: ${registration.id}`);
const mod = registration.factory(requireStub);

// ---- 最小宿主桩 ----
const dictionaries = {};
const sections = [];
const snapshot = {
  status: 'ready',
  writable: true,
  value: {
    desktop: { enabled: true, sound: false, timeoutSec: 8 },
    events: { taskComplete: true, needInput: true, error: false },
    ignoreSubagents: true,
    mail: { enabled: false, smtpHost: 'smtp.qq.com', smtpPort: 465, smtpSecure: true, smtpUser: 'a@b.c', from: 'a@b.c', to: 'a@b.c' },
  },
};
const writes = [];
const form = {
  getSnapshot: () => snapshot,
  subscribe: () => () => {},
  mutate: (ops) => {
    writes.push(ops);
    return Promise.resolve(true);
  },
};
const ctx = {
  locale: {
    bind: () => (key) => key,
    register: (ns, dicts) => {
      dictionaries[ns] = dicts;
      return () => {};
    },
  },
  configForms: {
    get: (ns) => {
      if (ns !== 'notify-desktop') throw new Error(`unexpected configForms.get(${ns})`);
      return form;
    },
    whileServed: (namespaces, register) => {
      register(new Set(namespaces));
      return () => {};
    },
  },
  slots: {
    inject: (_key, cb) => cb(),
    register: (options, Component) => {
      sections.push({ options, Component });
      return () => {};
    },
  },
  effect: (fn) => fn(),
};

mod.apply(ctx);

// ---- 断言 ----
const assert = (ok, message) => {
  if (!ok) throw new Error(`FAIL: ${message}`);
  console.log(`ok - ${message}`);
};

assert(typeof mod.apply === 'function', '导出 apply');
assert(Array.isArray(mod.inject) && mod.inject.includes('configForms'), '导出 inject');
assert(sections.length === 1, '注册了一个 settings.section 页面');
const { options, Component } = sections[0];
assert(options.name === 'settings.section', '注册到 settings.section');
assert(options.id === 'notify-desktop', '注册 id 为 notify-desktop');
assert(options.order === 30, '注册 order 为 30');
assert(options.label() === 'title', 'label 走词典 title');
assert(options.inject().notifyForm === form, 'inject 注入表单控制器');

// 词典对齐：zh 与 en 的键必须完全一致
const dicts = dictionaries['settings.notifyDesktop'];
assert(!!dicts, '注册了本地词典');
const zhKeys = Object.keys(dicts.zh).sort();
const enKeys = Object.keys(dicts.en).sort();
assert(JSON.stringify(zhKeys) === JSON.stringify(enKeys), 'zh / en 文案键一致');

// 递归渲染：函数组件就地展开，只保留宿主元素
function render(node) {
  if (node === null || node === undefined || node === false || node === true) return null;
  if (Array.isArray(node)) return node.map(render);
  if (typeof node === 'string' || typeof node === 'number') return node;
  if (typeof node.type === 'function') return render(node.type(node.props ?? {}));
  return { type: node.type, props: { ...(node.props ?? {}), children: render(node.props?.children) } };
}

const tree = render(Component({ notifyForm: form, t: (key) => key }));
assert(!!tree, '页面可以渲染出元素树');

// 收集所有 Switch 与 input
const switches = [];
const inputs = [];
(function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(walk);
  if (node.type === 'Switch') switches.push(node);
  if (node.type === 'input') inputs.push(node);
  walk(node.props?.children);
})(tree);

assert(switches.length === 8, `开关数量为 8（实际 ${switches.length}）`);
assert(inputs.length === 7, `输入框数量为 7（实际 ${inputs.length}）`);

// 每个开关都必须有可读的 aria-label（词典键存在）
for (const s of switches) {
  assert(typeof s.props.label === 'string' && s.props.label.length > 0, `开关有 aria-label: ${s.props.label}`);
}

// 点击第一个开关：应写入 desktop.enabled = false（当前为 true）
switches[0].props.onChange(false);
await new Promise((resolve) => setTimeout(resolve, 0));
assert(JSON.stringify(writes[0]) === JSON.stringify([{ op: 'set', path: ['desktop', 'enabled'], value: false }]), '开关写入 desktop.enabled');

// 第 7 个开关是「启用邮件通知」
switches[6].props.onChange(true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert(JSON.stringify(writes[1]) === JSON.stringify([{ op: 'set', path: ['mail', 'enabled'], value: true }]), '开关写入 mail.enabled');

// 输入框：数字框失焦提交解析后的数字
const timeoutInput = inputs.find((i) => i.props.value === '8');
assert(!!timeoutInput, '找到 timeoutSec 输入框（回显 8）');

// 文案完整性：页面用到的每个 t(key) 都应该在词典里
const used = new Set();
(function collect(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(collect);
  const children = node.props?.children;
  if (typeof children === 'string') used.add(children);
  collect(children);
})(tree);
const missing = [...used].filter((key) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(key) && !(key in dicts.zh) && !(key in dicts.en));
assert(missing.length === 0, `没有缺失的文案键${missing.length ? ': ' + missing.join(',') : ''}`);

console.log('\n全部通过');
