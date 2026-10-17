window.__ModuleLoader__.load({
	id: "dsh-notify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region 常量
		/**
		 * Host 端 Loader 的行 id，同时也是设置文档里的命名空间。
		 * 必须与包内 cordis.patch.yml 里的 `id: dsh-notify` 一致。
		 */
		const ENTRY_ID = "dsh-notify";
		/** 本插件自己的词典命名空间 */
		const NS = "settings.dshNotify";
		/** 设置面板左侧导航里的位置：General 0 / Models 10 / Plugins 15 / 本页 30 */
		const SECTION_ORDER = 30;
		//#endregion

		//#region 文案
		/** English copy. */
		const en = {
			title: "Notifications",
			description: "Get a desktop card (and optionally an email) when a task finishes or needs your confirmation.",
			desktopTitle: "Desktop popup",
			desktopHint: "A frosted-glass card in the bottom-right corner of the screen. Windows only.",
			desktopEnabled: "Show desktop popup",
			desktopEnabledHint: "Turn the card on or off entirely.",
			sound: "Play sound",
			soundHint: "Plays the bundled chime together with the card.",
			timeoutSec: "Auto-dismiss (seconds)",
			timeoutSecHint: "How long the card stays before it closes itself. Click the card to close it sooner.",
			eventsTitle: "When to notify",
			eventsHint: "Each kind of event can be switched off on its own.",
			taskComplete: "Task finished",
			taskCompleteHint: "Sent when a turn ends and the Agent goes idle again.",
			needInput: "Needs your confirmation",
			needInputHint: "Sent for tool approvals and for Agent questions.",
			error: "Task failed",
			errorHint: "Sent when a turn or step errors.",
			ignoreSubagents: "Ignore sub-agents",
			ignoreSubagentsHint: "Only notify about the main session, not about subagents or workflow children.",
			mailTitle: "Email",
			mailHint: "Send the same notification to a mailbox, so a phone notification can reach you too.",
			mailEnabled: "Send email",
			smtpHost: "SMTP server",
			smtpHostHint: "For example smtp.qq.com, smtp.163.com, smtp.gmail.com.",
			smtpPort: "Port",
			smtpPortHint: "465 with SSL, 587 with STARTTLS.",
			smtpSecure: "Use SSL",
			smtpSecureHint: "On for port 465 (QQ / 163 / Gmail), off for 587.",
			smtpUser: "SMTP user",
			smtpUserHint: "Usually the full email address.",
			smtpPass: "SMTP authorisation code",
			smtpPassHint: "The SMTP authorisation code, not the mailbox login password. Leave blank to keep the saved one.",
			clear: "Clear",
			from: "From",
			fromHint: "Must match the SMTP user for most providers.",
			to: "To",
			toHint: "Your own address, if you want to notify yourself.",
			readOnly: "This deployment stores settings read-only.",
			loading: "Loading…",
			saved: "Saved",
			saving: "Saving…",
			saveFailed: "The Host did not accept this value; the previous one is still in effect.",
			advancedTitle: "Troubleshooting",
			advancedHint: "To send a test notification, run /notify-test in the composer of any conversation.",
			logsHint: "Logs: DSH_HOME/logs/dsh-notify-YYYY-MM-DD.log",
			invalidNumber: "Enter a number.",
		};

		/** 简体中文文案 */
		const zh = {
			title: "通知",
			description: "任务完成或需要你确认时，在桌面右下角弹出毛玻璃卡片，也可以同时发邮件提醒。",
			desktopTitle: "桌面弹窗",
			desktopHint: "屏幕右下角的毛玻璃卡片，仅在 Windows 上可用。",
			desktopEnabled: "启用桌面弹窗",
			desktopEnabledHint: "总开关，关掉后不再弹卡片。",
			sound: "播放提示音",
			soundHint: "弹窗出现时同时播放随包的提示音。",
			timeoutSec: "自动消失（秒）",
			timeoutSecHint: "卡片停留多久后自动关闭；点击卡片可以提前关掉。",
			eventsTitle: "通知时机",
			eventsHint: "每类事件都可以单独关闭。",
			taskComplete: "任务完成",
			taskCompleteHint: "一轮对话结束、Agent 重新空闲时通知。",
			needInput: "需要你确认",
			needInputHint: "工具审批和 Agent 向你提问时通知。",
			error: "任务出错",
			errorHint: "某一轮或某一步出错时通知。",
			ignoreSubagents: "忽略子 Agent",
			ignoreSubagentsHint: "只通知主会话，子 Agent 和 workflow 子任务结束时不打扰。",
			mailTitle: "邮件通知",
			mailHint: "把同样的通知发到邮箱，手机也能收到推送。",
			mailEnabled: "启用邮件通知",
			smtpHost: "SMTP 服务器",
			smtpHostHint: "例如 smtp.qq.com、smtp.163.com、smtp.gmail.com。",
			smtpPort: "端口",
			smtpPortHint: "SSL 用 465，STARTTLS 用 587。",
			smtpSecure: "使用 SSL",
			smtpSecureHint: "465 端口（QQ / 163 / Gmail）打开，587 端口关闭。",
			smtpUser: "SMTP 用户名",
			smtpUserHint: "一般就是完整邮箱地址。",
			smtpPass: "SMTP 授权码",
			smtpPassHint: "填邮箱的 SMTP 授权码，不是登录密码。留空表示保持已保存的授权码。",
			clear: "清除",
			from: "发件人",
			fromHint: "多数邮箱要求它与 SMTP 用户名一致。",
			to: "收件人",
			toHint: "填自己就是自己发给自己。",
			readOnly: "本部署的设置为只读。",
			loading: "加载中…",
			saved: "已保存",
			saving: "保存中…",
			saveFailed: "Host 没有接受这个值，仍在使用原来的设置。",
			advancedTitle: "排查",
			advancedHint: "想发一条测试通知，在任意会话的输入框执行 /notify-test。",
			logsHint: "日志：DSH_HOME/logs/dsh-notify-YYYY-MM-DD.log",
			invalidNumber: "请填数字。",
		};
		//#endregion

		//#region 样式
		/** 取节点上的值，缺省返回 undefined */
		function getIn(root, path) {
			let node = root;
			for (const key of path) {
				if (node === null || typeof node !== "object") return undefined;
				node = node[key];
			}
			return node;
		}

		const styles = {
			page: {
				display: "flex",
				flexDirection: "column",
				gap: "20px",
				paddingTop: "20px",
				paddingBottom: "24px",
				maxWidth: "720px",
			},
			heading: {
				margin: 0,
				fontSize: "16px",
				lineHeight: "24px",
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary)",
			},
			description: {
				margin: "6px 0 0",
				fontSize: "13px",
				lineHeight: "20px",
				color: "var(--dsw-alias-label-secondary)",
			},
			card: {
				display: "flex",
				flexDirection: "column",
				gap: "14px",
				padding: "16px",
				borderRadius: "var(--dsw-radius-lg)",
				background: "var(--dsw-alias-settings-card-fill)",
				border: "1px solid var(--dsw-alias-settings-card-stroke)",
			},
			cardTitle: {
				margin: 0,
				fontSize: "14px",
				lineHeight: "20px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-primary)",
			},
			row: {
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "space-between",
				gap: "16px",
			},
			rowText: {
				display: "flex",
				flexDirection: "column",
				gap: "2px",
				minWidth: 0,
			},
			rowLabel: {
				fontSize: "13px",
				lineHeight: "20px",
				color: "var(--dsw-alias-label-primary)",
			},
			rowHint: {
				fontSize: "12px",
				lineHeight: "18px",
				color: "var(--dsw-alias-label-caption)",
			},
			field: {
				width: "320px",
				maxWidth: "55%",
				boxSizing: "border-box",
				padding: "6px 10px",
				fontSize: "13px",
				lineHeight: "20px",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-2)",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRadius: "var(--dsw-radius-sm)",
				outline: "none",
			},
			notice: {
				padding: "10px 12px",
				fontSize: "12px",
				lineHeight: "18px",
				borderRadius: "var(--dsw-radius-sm)",
				color: "var(--dsw-alias-warn-label)",
				background: "var(--dsw-alias-state-warn-secondary)",
			},
			error: {
				padding: "10px 12px",
				fontSize: "12px",
				lineHeight: "18px",
				borderRadius: "var(--dsw-radius-sm)",
				color: "var(--dsw-alias-state-error-primary)",
				background: "var(--dsw-alias-bg-layer-2)",
			},
			inline: {
				display: "flex",
				alignItems: "center",
				gap: "8px",
			},
		};
		//#endregion

		//#region 基础控件
		/**
		 * 一行「标签 + 说明 + 右侧开关」。
		 * @param props - t、标签、说明、当前值、是否禁用、变更回调。
		 */
		function SwitchRow(props) {
			const { t, labelKey, hintKey, checked, disabled, onChange } = props;
			return react_jsx_runtime.jsxs("div", {
				style: styles.row,
				children: [
					react_jsx_runtime.jsxs("div", {
						style: styles.rowText,
						children: [
							react_jsx_runtime.jsx("span", { style: styles.rowLabel, children: t(labelKey) }),
							react_jsx_runtime.jsx("span", { style: styles.rowHint, children: t(hintKey) }),
						],
					}),
					react_jsx_runtime.jsx(primitives.Switch, {
						checked: checked === true,
						disabled: disabled === true,
						label: t(labelKey),
						onChange: (next) => onChange(next),
					}),
				],
			});
		}

		/**
		 * 一行「标签 + 说明 + 右侧输入框」。输入过程中只改本地草稿，
		 * 失焦或回车时才提交，避免每敲一个字符就写一次设置文档。
		 * @param props - t、标签、说明、当前值、是否数字、是否密码、是否禁用、提交回调。
		 */
		function InputRow(props) {
			const { t, labelKey, hintKey, value, numeric, secret, disabled, onCommit, extra } = props;
			const external = value === undefined || value === null ? "" : String(value);
			const [draft, setDraft] = react.useState(secret ? "" : external);
			const [focused, setFocused] = react.useState(false);
			const [invalid, setInvalid] = react.useState(false);

			// 外部值变化时同步草稿；正在输入的输入框不要被覆盖
			react.useEffect(() => {
				if (!focused) setDraft(secret ? "" : external);
			}, [external, focused, secret]);

			const commit = () => {
				const raw = String(draft);
				if (secret) {
					// 密码框留空表示保持原值
					if (raw.length === 0) return;
					onCommit(raw);
					setDraft("");
					return;
				}
				if (numeric) {
					const trimmed = raw.trim();
					if (trimmed.length === 0) {
						setInvalid(false);
						onCommit(undefined);
						return;
					}
					const parsed = Number(trimmed);
					if (!Number.isFinite(parsed)) {
						setInvalid(true);
						return;
					}
					setInvalid(false);
					onCommit(parsed);
					return;
				}
				if (raw === external) return;
				onCommit(raw.length === 0 ? undefined : raw);
			};

			const input = react_jsx_runtime.jsx("input", {
				type: secret ? "password" : numeric ? "text" : "text",
				inputMode: numeric ? "numeric" : undefined,
				autoComplete: secret ? "new-password" : "off",
				style: invalid ? { ...styles.field, borderColor: "var(--dsw-alias-state-error-primary)" } : styles.field,
				value: draft,
				disabled: disabled === true,
				placeholder: secret ? "••••••" : undefined,
				onChange: (event) => setDraft(event.target.value),
				onFocus: () => setFocused(true),
				onBlur: () => {
					setFocused(false);
					commit();
				},
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						event.currentTarget.blur();
					}
				},
			});

			return react_jsx_runtime.jsxs("div", {
				style: styles.row,
				children: [
					react_jsx_runtime.jsxs("div", {
						style: styles.rowText,
						children: [
							react_jsx_runtime.jsx("span", { style: styles.rowLabel, children: t(labelKey) }),
							react_jsx_runtime.jsx("span", { style: styles.rowHint, children: t(invalid ? "invalidNumber" : hintKey) }),
						],
					}),
					react_jsx_runtime.jsxs("div", {
						style: styles.inline,
						children: [
							input,
							extra
								? react_jsx_runtime.jsx(primitives.Button, {
									variant: "ghost",
									size: "sm",
									disabled: disabled === true,
									onClick: () => {
										setDraft("");
										onCommit(undefined);
									},
									children: t("clear"),
								})
								: null,
						],
					}),
				],
			});
		}

		/** 一张分组卡片 */
		function Card(props) {
			return react_jsx_runtime.jsxs("section", {
				style: styles.card,
				children: [
					react_jsx_runtime.jsx("h3", { style: styles.cardTitle, children: props.title }),
					props.hint ? react_jsx_runtime.jsx("p", { style: styles.description, children: props.hint }) : null,
					props.children,
				],
			});
		}
		//#endregion

		//#region 设置页面
		/**
		 * 「设置 → 通知」页面。
		 * 每次修改立即写入 Host 设置文档（volatile 字段改完即生效，不用重启）；
		 * 写入失败时保留旧值并给出提示。
		 * @param props - notifyForm（设置表单控制器）与 t（本页词典）。
		 */
		function NotifySection(props) {
			const { notifyForm: form, t } = props;
			const [state, setState] = react.useState("idle");

			const subscribe = react.useCallback((listener) => form.subscribe(listener), [form]);
			const readSnapshot = react.useCallback(() => form.getSnapshot(), [form]);
			const snapshot = react.useSyncExternalStore(subscribe, readSnapshot);

			const value = snapshot.value;
			const writable = snapshot.writable === true && snapshot.status === "ready";
			const disabled = !writable;

			/** 写入一个设置项；空值用 unset 回到默认 */
			const commit = react.useCallback((path, next) => {
				const ops = next === undefined
					? [{ op: "unset", path }]
					: [{ op: "set", path, value: next }];
				setState("saving");
				void form.mutate(ops).then((ok) => {
					setState(ok ? "saved" : "error");
					if (ok) setTimeout(() => setState((current) => (current === "saved" ? "idle" : current)), 1600);
				}, () => setState("error"));
			}, [form]);

			const bindSwitch = (path) => (next) => commit(path, next);

			const section = (children) => react_jsx_runtime.jsx("div", {
				style: { display: "flex", flexDirection: "column", gap: "14px" },
				children,
			});

			return react_jsx_runtime.jsxs("div", {
				style: styles.page,
				children: [
					react_jsx_runtime.jsxs("header", {
						children: [
							react_jsx_runtime.jsx("h2", { style: styles.heading, children: t("title") }),
							react_jsx_runtime.jsx("p", { style: styles.description, children: t("description") }),
						],
					}),
					snapshot.status === "loading"
						? react_jsx_runtime.jsx("div", { style: styles.notice, children: t("loading") })
						: null,
					snapshot.status === "ready" && !writable
						? react_jsx_runtime.jsx("div", { style: styles.notice, children: t("readOnly") })
						: null,
					state === "error" ? react_jsx_runtime.jsx("div", { style: styles.error, children: t("saveFailed") }) : null,
					state === "saving" ? react_jsx_runtime.jsx("div", { style: styles.rowHint, children: t("saving") }) : null,
					state === "saved" ? react_jsx_runtime.jsx("div", { style: styles.rowHint, children: t("saved") }) : null,

					react_jsx_runtime.jsxs(Card, {
						title: t("desktopTitle"),
						hint: t("desktopHint"),
						children: [
							react_jsx_runtime.jsx(SwitchRow, {
								t,
								labelKey: "desktopEnabled",
								hintKey: "desktopEnabledHint",
								checked: getIn(value, ["desktop", "enabled"]),
								disabled,
								onChange: bindSwitch(["desktop", "enabled"]),
							}),
							react_jsx_runtime.jsx(SwitchRow, {
								t,
								labelKey: "sound",
								hintKey: "soundHint",
								checked: getIn(value, ["desktop", "sound"]),
								disabled,
								onChange: bindSwitch(["desktop", "sound"]),
							}),
							react_jsx_runtime.jsx(InputRow, {
								t,
								labelKey: "timeoutSec",
								hintKey: "timeoutSecHint",
								numeric: true,
								value: getIn(value, ["desktop", "timeoutSec"]),
								disabled,
								onCommit: (next) => commit(["desktop", "timeoutSec"], next),
							}),
						],
					}),

					react_jsx_runtime.jsx(Card, {
						title: t("eventsTitle"),
						hint: t("eventsHint"),
						children: section([
							react_jsx_runtime.jsx(SwitchRow, {
								t,
								labelKey: "taskComplete",
								hintKey: "taskCompleteHint",
								checked: getIn(value, ["events", "taskComplete"]),
								disabled,
								onChange: bindSwitch(["events", "taskComplete"]),
							}),
							react_jsx_runtime.jsx(SwitchRow, {
								t,
								labelKey: "needInput",
								hintKey: "needInputHint",
								checked: getIn(value, ["events", "needInput"]),
								disabled,
								onChange: bindSwitch(["events", "needInput"]),
							}),
							react_jsx_runtime.jsx(SwitchRow, {
								t,
								labelKey: "error",
								hintKey: "errorHint",
								checked: getIn(value, ["events", "error"]),
								disabled,
								onChange: bindSwitch(["events", "error"]),
							}),
							react_jsx_runtime.jsx(SwitchRow, {
								t,
								labelKey: "ignoreSubagents",
								hintKey: "ignoreSubagentsHint",
								checked: getIn(value, ["ignoreSubagents"]),
								disabled,
								onChange: bindSwitch(["ignoreSubagents"]),
							}),
						]),
					}),

					react_jsx_runtime.jsxs(Card, {
						title: t("mailTitle"),
						hint: t("mailHint"),
						children: [
							react_jsx_runtime.jsx(SwitchRow, {
								t,
								labelKey: "mailEnabled",
								hintKey: "mailHint",
								checked: getIn(value, ["mail", "enabled"]),
								disabled,
								onChange: bindSwitch(["mail", "enabled"]),
							}),
							section([
								react_jsx_runtime.jsx(InputRow, {
									t,
									labelKey: "smtpHost",
									hintKey: "smtpHostHint",
									value: getIn(value, ["mail", "smtpHost"]),
									disabled,
									onCommit: (next) => commit(["mail", "smtpHost"], next),
								}),
								react_jsx_runtime.jsx(InputRow, {
									t,
									labelKey: "smtpPort",
									hintKey: "smtpPortHint",
									numeric: true,
									value: getIn(value, ["mail", "smtpPort"]),
									disabled,
									onCommit: (next) => commit(["mail", "smtpPort"], next),
								}),
								react_jsx_runtime.jsx(SwitchRow, {
									t,
									labelKey: "smtpSecure",
									hintKey: "smtpSecureHint",
									checked: getIn(value, ["mail", "smtpSecure"]),
									disabled,
									onChange: bindSwitch(["mail", "smtpSecure"]),
								}),
								react_jsx_runtime.jsx(InputRow, {
									t,
									labelKey: "smtpUser",
									hintKey: "smtpUserHint",
									value: getIn(value, ["mail", "smtpUser"]),
									disabled,
									onCommit: (next) => commit(["mail", "smtpUser"], next),
								}),
								react_jsx_runtime.jsx(InputRow, {
									t,
									labelKey: "smtpPass",
									hintKey: "smtpPassHint",
									secret: true,
									extra: true,
									disabled,
									onCommit: (next) => commit(["mail", "smtpPass"], next),
								}),
								react_jsx_runtime.jsx(InputRow, {
									t,
									labelKey: "from",
									hintKey: "fromHint",
									value: getIn(value, ["mail", "from"]),
									disabled,
									onCommit: (next) => commit(["mail", "from"], next),
								}),
								react_jsx_runtime.jsx(InputRow, {
									t,
									labelKey: "to",
									hintKey: "toHint",
									value: getIn(value, ["mail", "to"]),
									disabled,
									onCommit: (next) => commit(["mail", "to"], next),
								}),
							]),
						],
					}),

					react_jsx_runtime.jsx(Card, {
						title: t("advancedTitle"),
						children: section([
							react_jsx_runtime.jsx("span", { style: styles.rowHint, children: t("advancedHint") }),
							react_jsx_runtime.jsx("span", { style: styles.rowHint, children: t("logsHint") }),
						]),
					}),
				],
			});
		}
		//#endregion

		//#region 插件入口
		/** 需要的客户端服务 */
		const inject = ["slots", "locale", "configForms"];

		/**
		 * 把「通知」页面注册进 DSH 的设置面板。
		 * 只有 Host 端确实提供了 `dsh-notify` 这个设置命名空间时才注册，
		 * 因此插件被关掉时设置里也不会留下一个空页面。
		 * @param ctx 浏览器端 cordis 上下文
		 */
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-notify: dictionaries");

			const form = ctx.configForms.get(ENTRY_ID);

			ctx.effect(() => ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-notify",
				order: SECTION_ORDER,
				label: () => t("title"),
				locale: NS,
				inject: () => ({ notifyForm: form }),
			}, NotifySection))), "dsh-notify: settings page");
		}
		//#endregion

		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
