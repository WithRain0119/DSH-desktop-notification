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

// describe() 的镜像：只有 secrets 标记，没有明文（和 Host 的真实行为一致）
const describeListeners = new Set();
const describeState = {
  status: 'ready',
  view: { writable: true, namespaces: [{ ns: 'notify-desktop', secrets: [] }] },
};
const describe = {
  getSnapshot: () => describeState,
  subscribe: (listener) => {
    describeListeners.add(listener);
    return () => describeListeners.delete(listener);
  },
};
const setSecretConfigured = (configured) => {
  describeState.view.namespaces[0].secrets = configured ? [{ path: ['mail', 'smtpPass'], set: true }] : [];
  for (const listener of describeListeners) listener();
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
    describe: () => describe,
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
const injected = options.inject();
assert(injected.notifyForm === form, 'inject 注入表单控制器');
assert(!!injected.secretStore && typeof injected.secretStore.getSnapshot === 'function', 'inject 注入授权码状态 store');

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

const renderPage = () => render(Component({ ...options.inject(), t: (key) => key }));
let tree = renderPage();
assert(!!tree, '页面可以渲染出元素树');

// 收集所有 Switch / input / 按钮
function collectAll(root) {
  const switches = [];
  const inputs = [];
  const buttons = [];
  const texts = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === 'Switch') switches.push(node);
    if (node.type === 'input') inputs.push(node);
    if (node.type === 'Button') buttons.push(node);
    const children = node.props?.children;
    if (typeof children === 'string') texts.push(children);
    walk(children);
  })(root);
  return { switches, inputs, buttons, texts };
}

let { switches, inputs, buttons, texts } = collectAll(tree);
assert(switches.length === 8, `开关数量为 8（实际 ${switches.length}）`);
assert(inputs.length === 7, `输入框数量为 7（实际 ${inputs.length}）`);
assert(buttons.filter((b) => b.props.children === 'presetQQ').length === 1, '有 QQ 邮箱预设按钮');
assert(buttons.length >= 5, `预设按钮 + 清除按钮都在（实际 ${buttons.length} 个）`);

// 每个开关都必须有可读的 aria-label（词典键存在）
for (const s of switches) {
  assert(typeof s.props.label === 'string' && s.props.label.length > 0, `开关有 aria-label: ${s.props.label}`);
}

// 授权码：未配置时显示「未配置」、placeholder 提示输入
assert(texts.includes('passUnconfigured'), '授权码未配置时显示「未配置」角标');
const passInput = inputs.find((i) => i.props.type === 'password');
assert(!!passInput && passInput.props.placeholder === 'passPlaceholder', '授权码输入框用「请输入」占位');

// 填了授权码之后（Host 的 secrets 标记变化）：角标变成「已配置」，placeholder 变成「留空表示不修改」
setSecretConfigured(true);
tree = renderPage();
({ inputs, texts } = collectAll(tree));
assert(texts.includes('passConfigured'), '授权码配置后显示「已配置」角标');
assert(inputs.find((i) => i.props.type === 'password').props.placeholder === 'passPlaceholderSet', '授权码已配置后占位改为「留空表示不修改」');
setSecretConfigured(false);
tree = renderPage();
({ switches, inputs, buttons, texts } = collectAll(tree));

// 点击第一个开关：应写入 desktop.enabled = false（当前为 true）
switches[0].props.onChange(false);
await new Promise((resolve) => setTimeout(resolve, 0));
assert(JSON.stringify(writes[0]) === JSON.stringify([{ op: 'set', path: ['desktop', 'enabled'], value: false }]), '开关写入 desktop.enabled');

// 第 7 个开关是「启用邮件通知」
switches[6].props.onChange(true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert(JSON.stringify(writes[1]) === JSON.stringify([{ op: 'set', path: ['mail', 'enabled'], value: true }]), '开关写入 mail.enabled');

// 预设按钮：三个值一次原子提交
const qqButton = buttons.find((b) => b.props.children === 'presetQQ');
qqButton.props.onClick();
await new Promise((resolve) => setTimeout(resolve, 0));
assert(
  JSON.stringify(writes[2]) === JSON.stringify([
    { op: 'set', path: ['mail', 'smtpHost'], value: 'smtp.qq.com' },
    { op: 'set', path: ['mail', 'smtpPort'], value: 465 },
    { op: 'set', path: ['mail', 'smtpSecure'], value: true },
  ]),
  'QQ 预设一次提交服务器/端口/SSL',
);

// 输入框：数字框失焦提交解析后的数字
const timeoutInput = inputs.find((i) => i.props.value === '8');
assert(!!timeoutInput, '找到 timeoutSec 输入框（回显 8）');

// 把 SMTP 服务器写成邮箱地址时给出提示（用户真实踩到的坑）
snapshot.value.mail.smtpHost = 'someone@qq.com';
tree = renderPage();
assert(collectAll(tree).texts.includes('hostWarning'), 'SMTP 服务器填成邮箱地址时给出警告');
snapshot.value.mail.smtpHost = 'smtp.qq.com';
tree = renderPage();

// 文案完整性：页面用到的每个 t(key) 都应该在词典里
const used = new Set(collectAll(tree).texts);
const missing = [...used].filter((key) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(key) && !(key in dicts.zh) && !(key in dicts.en));
assert(missing.length === 0, `没有缺失的文案键${missing.length ? ': ' + missing.join(',') : ''}`);

console.log('\n全部通过');
