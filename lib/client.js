window.__ModuleLoader__.load({
	id: "dsh-desktop-notification",
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
		 * 必须与包内 cordis.patch.yml 里的 `id: notify-desktop` 一致。
		 *
		 * 注意它和包名不同：包名（= 本 bundle 的 id）是 `dsh-desktop-notification`，
		 * 之所以不叫 `dsh-notify`，是因为 npm 上已有同名插件，避免装错。
		 */
		const ENTRY_ID = "notify-desktop";
		/** 本插件自己的词典命名空间 */
		const NS = "settings.notifyDesktop";
		/** 设置面板左侧导航里的位置：General 0 / Models 10 / Plugins 15 / 本页 30 */
		const SECTION_ORDER = 30;
		/**
		 * 常用邮箱的一键填充参数。
		 * 服务器/端口/SSL 三者容易配错（尤其把邮箱地址填进「SMTP 服务器」），
		 * 因此提供预设按钮，三个值在 Host 上一次原子提交。
		 */
		const EMAIL_PRESETS = [
			{ id: "qq", labelKey: "presetQQ", host: "smtp.qq.com", port: 465, secure: true },
			{ id: "163", labelKey: "preset163", host: "smtp.163.com", port: 465, secure: true },
			{ id: "gmail", labelKey: "presetGmail", host: "smtp.gmail.com", port: 465, secure: true },
			{ id: "outlook", labelKey: "presetOutlook", host: "smtp.office365.com", port: 587, secure: false },
		];
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
			mailEnabledHint: "Send every notification to a mailbox as well.",
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
			passConfigured: "Configured",
			passUnconfigured: "Not configured",
			passPlaceholder: "Enter the SMTP authorisation code",
			passPlaceholderSet: "Configured — leave blank to keep it",
			presets: "Presets",
			presetsHint: "Fill in the server, port and SSL for a common provider in one go.",
			presetQQ: "QQ Mail",
			preset163: "163 Mail",
			presetGmail: "Gmail",
			presetOutlook: "Outlook",
			hostWarning: "This looks like an email address — the SMTP server should be a host such as smtp.qq.com.",
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
			logsHint: "Logs: DSH_HOME/logs/notify-desktop-YYYY-MM-DD.log",
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
			mailEnabledHint: "每条通知同时发一封邮件。",
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
			passConfigured: "已配置",
			passUnconfigured: "未配置",
			passPlaceholder: "请输入 SMTP 授权码",
			passPlaceholderSet: "已配置，留空表示不修改",
			presets: "常用邮箱",
			presetsHint: "一键填好服务器、端口与 SSL，再补上用户名和授权码。",
			presetQQ: "QQ 邮箱",
			preset163: "163 邮箱",
			presetGmail: "Gmail",
			presetOutlook: "Outlook",
			hostWarning: "这里看着像邮箱地址——SMTP 服务器应填主机名，例如 smtp.qq.com。",
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
			logsHint: "日志：DSH_HOME/logs/notify-desktop-YYYY-MM-DD.log",
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
			badge: {
				marginLeft: "8px",
				padding: "0 6px",
				fontSize: "11px",
				lineHeight: "16px",
				borderRadius: "var(--dsw-radius-xs)",
				color: "var(--dsw-alias-label-tertiary)",
				background: "var(--dsw-alias-bg-layer-2)",
				border: "1px solid var(--dsw-alias-border-l2)",
			},
			badgeOk: {
				marginLeft: "8px",
				padding: "0 6px",
				fontSize: "11px",
				lineHeight: "16px",
				borderRadius: "var(--dsw-radius-xs)",
				color: "var(--dsw-alias-state-success-primary)",
				background: "var(--dsw-alias-bg-layer-2)",
				border: "1px solid var(--dsw-alias-state-success-primary)",
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
		 *
		 * 密码类字段是「只写」的：Host 的读取结果里不会有明文，所以这里用
		 * configured 显示「已配置/未配置」，而不是把值回显出来。
		 * 提交失败时保留草稿，别让用户白打一遍。
		 * @param props - t、标签、说明、当前值、是否数字、是否密码、已配置状态、是否禁用、提交回调。
		 */
		function InputRow(props) {
			const { t, labelKey, hintKey, value, numeric, secret, configured, disabled, onCommit, extra } = props;
			const external = value === undefined || value === null ? "" : String(value);
			const [draft, setDraft] = react.useState(secret ? "" : external);
			const [focused, setFocused] = react.useState(false);
			const [invalid, setInvalid] = react.useState(false);
			const [pending, setPending] = react.useState(false);
			const [justSaved, setJustSaved] = react.useState(false);

			// 外部值变化时同步草稿；正在输入的输入框不要被覆盖
			react.useEffect(() => {
				if (!focused) setDraft(secret ? "" : external);
			}, [external, focused, secret]);

			/** 提交一次编辑；返回是否成功，成功才清掉密码框里的草稿 */
			const commit = () => {
				const raw = String(draft);
				const run = (next) => {
					setPending(true);
					return Promise.resolve(onCommit(next)).then((ok) => {
						setPending(false);
						if (ok === false) return false;
						if (secret) {
							setDraft("");
							setJustSaved(true);
							setTimeout(() => setJustSaved(false), 2000);
						}
						return true;
					}, () => {
						setPending(false);
						return false;
					});
				};

				if (secret) {
					// 密码框留空表示保持原值
					if (raw.length === 0) return;
					run(raw);
					return;
				}
				if (numeric) {
					const trimmed = raw.trim();
					if (trimmed.length === 0) {
						setInvalid(false);
						run(undefined);
						return;
					}
					const parsed = Number(trimmed);
					if (!Number.isFinite(parsed)) {
						setInvalid(true);
						return;
					}
					setInvalid(false);
					run(parsed);
					return;
				}
				if (raw === external) return;
				run(raw.length === 0 ? undefined : raw);
			};

			const secretState = secret
				? justSaved
					? t("saved")
					: pending
						? t("saving")
						: configured === true
							? t("passConfigured")
							: t("passUnconfigured")
				: "";

			const input = react_jsx_runtime.jsx("input", {
				type: secret ? "password" : "text",
				inputMode: numeric ? "numeric" : undefined,
				autoComplete: secret ? "new-password" : "off",
				style: invalid ? { ...styles.field, borderColor: "var(--dsw-alias-state-error-primary)" } : styles.field,
				value: draft,
				disabled: disabled === true,
				placeholder: secret ? t(configured === true ? "passPlaceholderSet" : "passPlaceholder") : undefined,
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
							react_jsx_runtime.jsxs("span", {
								style: styles.rowLabel,
								children: [
									t(labelKey),
									secret
										? react_jsx_runtime.jsx("span", {
											style: configured === true && !justSaved ? styles.badgeOk : styles.badge,
											children: secretState,
										})
										: null,
								],
							}),
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
		 * @param props - notifyForm（设置表单控制器）、secretStore（授权码是否已配置）与 t（本页词典）。
		 */
		function NotifySection(props) {
			const { notifyForm: form, secretStore, t } = props;
			const [state, setState] = react.useState("idle");

			const subscribe = react.useCallback((listener) => form.subscribe(listener), [form]);
			const readSnapshot = react.useCallback(() => form.getSnapshot(), [form]);
			const snapshot = react.useSyncExternalStore(subscribe, readSnapshot);
			const secrets = react.useSyncExternalStore(secretStore.subscribe, secretStore.getSnapshot);

			const value = snapshot.value;
			const writable = snapshot.writable === true && snapshot.status === "ready";
			const disabled = !writable;

			/** 一次提交多个设置项，例如一键填充邮箱预设；返回是否成功 */
			const commitOps = react.useCallback((ops) => {
				setState("saving");
				return form.mutate(ops).then((ok) => {
					setState(ok ? "saved" : "error");
					if (ok) setTimeout(() => setState((current) => (current === "saved" ? "idle" : current)), 1600);
					return ok;
				}, () => {
					setState("error");
					return false;
				});
			}, [form]);

			/** 写入一个设置项；空值用 unset 回到默认 */
			const commit = react.useCallback((path, next) => {
				const ops = next === undefined
					? [{ op: "unset", path }]
					: [{ op: "set", path, value: next }];
				return commitOps(ops);
			}, [commitOps]);

			const fillPreset = (preset) => commitOps([
				{ op: "set", path: ["mail", "smtpHost"], value: preset.host },
				{ op: "set", path: ["mail", "smtpPort"], value: preset.port },
				{ op: "set", path: ["mail", "smtpSecure"], value: preset.secure },
			]);

			const bindSwitch = (path) => (next) => {
				void commit(path, next);
			};

			const section = (children) => react_jsx_runtime.jsx("div", {
				style: { display: "flex", flexDirection: "column", gap: "14px" },
				children,
			});

			const smtpHost = getIn(value, ["mail", "smtpHost"]);
			const hostLooksLikeEmail = typeof smtpHost === "string" && smtpHost.includes("@");

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
								hintKey: "mailEnabledHint",
								checked: getIn(value, ["mail", "enabled"]),
								disabled,
								onChange: bindSwitch(["mail", "enabled"]),
							}),
							section([
								// 常用邮箱预设：一次写入服务器 / 端口 / SSL 三个值（Host 上原子提交）
								react_jsx_runtime.jsxs("div", {
									style: styles.row,
									children: [
										react_jsx_runtime.jsxs("div", {
											style: styles.rowText,
											children: [
												react_jsx_runtime.jsx("span", { style: styles.rowLabel, children: t("presets") }),
												react_jsx_runtime.jsx("span", { style: styles.rowHint, children: t("presetsHint") }),
											],
										}),
										react_jsx_runtime.jsx("div", {
											style: styles.inline,
											children: EMAIL_PRESETS.map((preset) => react_jsx_runtime.jsx(primitives.Button, {
												variant: "ghost",
												size: "sm",
												disabled,
												onClick: () => fillPreset(preset),
												children: t(preset.labelKey),
											}, preset.id)),
										}),
									],
								}),
								hostLooksLikeEmail
									? react_jsx_runtime.jsx("div", { style: styles.notice, children: t("hostWarning") })
									: null,
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
									configured: secrets.passConfigured,
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
		 * 只有 Host 端确实提供了 `notify-desktop` 这个设置命名空间时才注册，
		 * 因此插件被关掉时设置里也不会留下一个空页面。
		 * @param ctx 浏览器端 cordis 上下文
		 */
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "notify-desktop: dictionaries");

			const form = ctx.configForms.get(ENTRY_ID);

			// 授权码是只写字段：Host 的读取结果里没有明文，只有 describe() 里的
			// secrets[{ path, set }] 标记「是否已配置」。用它做一个可订阅的小 store。
			const describe = ctx.configForms.describe();
			let secretState = { passConfigured: false };
			const secretListeners = new Set();
			const syncSecretState = () => {
				const view = describe.getSnapshot().view?.namespaces?.find((row) => row.ns === ENTRY_ID);
				const configured = (view?.secrets ?? []).some((entry) => Array.isArray(entry.path)
					&& entry.path.length === 2
					&& entry.path[0] === "mail"
					&& entry.path[1] === "smtpPass"
					&& entry.set === true);
				if (configured === secretState.passConfigured) return;
				secretState = { passConfigured: configured };
				for (const listener of secretListeners) listener();
			};
			ctx.effect(() => {
				const off = describe.subscribe(syncSecretState);
				syncSecretState();
				return off;
			}, "notify-desktop: secret presence");
			ctx.effect(() => () => secretListeners.clear(), "notify-desktop: secret listeners");
			const secretStore = {
				subscribe: (listener) => {
					secretListeners.add(listener);
					return () => secretListeners.delete(listener);
				},
				getSnapshot: () => secretState,
			};

			ctx.effect(() => ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "notify-desktop",
				order: SECTION_ORDER,
				label: () => t("title"),
				locale: NS,
				inject: () => ({ notifyForm: form, secretStore }),
			}, NotifySection))), "notify-desktop: settings page");
		}
		//#endregion

		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
