export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_STORAGE_KEY = "fast-cesto-language";
export const SUPPORTED_LANGUAGES = Object.freeze(["en", "zh-CN"]);

export const translations = Object.freeze({
  en: {
    "app.subtitle": "Local, recoverable pacing and progression QoL configurator",
    "status.checking": "Checking",
    "notice.label": "Privacy notice",
    "notice.prefix": "Everything is processed locally.",
    "notice.text": "The tool does not connect to the internet, read saves, or upload game files. Close the game before applying changes.",
    "step.location": "01 · Location",
    "heading.gameDirectory": "Confirm game directory",
    "action.refresh": "Refresh status",
    "field.gameDirectory": "SolCesto directory",
    "field.gameDirectoryHelp.before": "The folder must contain",
    "field.gameDirectoryHelp.and": "and",
    "details.advanced": "Advanced: backup and state directory",
    "field.stateDirectory": "State directory",
    "preflight.title": "Alpha compatibility preflight",
    "preflight.help": "Read-only checks for version, permissions, space, backup, and the game process",
    "preflight.waiting": "Waiting",
    "preflight.collecting": "Collecting environment information…",
    "preflight.changeRefresh": "Refresh status after changing a directory.",
    "preflight.readyWarnings": "Ready, with notes",
    "preflight.ready": "Ready to install",
    "preflight.blocking": "{count} blocking",
    "step.experience": "02 · Experience",
    "heading.basePace": "Choose base pacing",
    "legend.baseSpeed": "Base speed",
    "speed.original": "Original",
    "speed.gentle": "Gentle",
    "speed.recommended": "Recommended",
    "speed.fast": "Fast",
    "zoom.title": "Disable movement camera zoom",
    "zoom.help": "Removes only the repeated camera Tween during movement",
    "step.progress": "03 · Progression",
    "heading.goldMultiplier": "Permanent-gold multiplier",
    "gold.hint": "Affects only permanent gold earned in the future. Existing balances and purchase prices are unchanged.",
    "legend.goldMultiplier": "Gold multiplier",
    "gold.recommended": "2× Recommended",
    "step.turbo": "04 · Temporary speed",
    "heading.turbo": "Hold for Turbo",
    "field.key": "Key",
    "key.leftShift": "Left Shift",
    "key.rightShift": "Right Shift",
    "field.extraMultiplier": "Extra multiplier",
    "heading.focus": "Hold for Focus",
    "focus.help": "Temporarily slow the game for reaction-heavy hazards",
    "key.leftControl": "Left Ctrl",
    "key.rightControl": "Right Ctrl",
    "field.targetSpeed": "Target speed",
    "step.apply": "05 · Apply",
    "confirm.gameClosed": "I have closed the game",
    "action.apply": "Apply configuration",
    "action.restore": "Restore original",
    "activity.ready": "Ready",
    "activity.reading": "Reading the current installation state.",
    "action.diagnostic": "Download privacy-filtered diagnostics",
    "footer.label": "Fast Cesto Public Alpha · Unofficial tool",
    "action.shutdown": "Close tool",
    "activity.processing": "Processing",
    "busy.wait": "Processing, please wait…",
    "busy.reading": "Reading archive hashes and backup state…",
    "busy.connecting": "Connecting to the local patcher…",
    "busy.installing": "Building, verifying, and swapping the local archive…",
    "busy.restoring": "Verifying the backup and restoring the original archive…",
    "busy.diagnostic": "Generating a report without paths, saves, or game resources…",
    "status.unrecognized": "Unrecognized",
    "status.installed": "Mod installed",
    "status.original": "Original",
    "status.unknown": "Unknown build",
    "status.gameRunning": "Game is running",
    "value.valid": "valid",
    "value.invalid": "invalid",
    "activity.statusRefreshed": "Status refreshed",
    "activity.installedState": "Backup is {backup}; configuration state is {manifest}.",
    "activity.detectedOriginal": "Detected the supported Epic 1.01.4b original archive.",
    "activity.unsupportedArchive": "The current archive is not a registered original or Fast Cesto build.",
    "activity.cannotReadStatus": "Could not read status",
    "activity.readyMessage": "Choose a configuration to apply. All operations stay on this computer.",
    "activity.closeGame": "Close the game first.",
    "activity.confirmDirectory": "Confirm directories",
    "activity.directoryNotFound": "The game directory was not found.",
    "activity.initializationFailed": "Interface initialization failed",
    "activity.configurationApplied": "Configuration applied",
    "activity.alreadyInstalled": "This configuration is already installed; no file was rewritten.",
    "activity.archiveApplied": "The new archive passed hash verification and the original backup remains valid.",
    "activity.applyFailed": "Apply failed",
    "activity.notConfirmed": "Not confirmed",
    "activity.confirmClosedFirst": "Select “I have closed the game” first.",
    "confirm.restore": "Restoring the original disables the current Mod features but does not change saves or gold already earned. Continue?",
    "activity.originalRestored": "Original restored",
    "activity.restoreMessage": "The archive now matches the supported original hash. Gold already earned is unchanged.",
    "activity.restoreFailed": "Restore failed",
    "activity.diagnosticDownloaded": "Diagnostic report downloaded",
    "activity.diagnosticMessage": "The report contains only versions, hashes, configuration enums, and privacy-filtered operation results.",
    "activity.diagnosticFailed": "Diagnostic export failed",
    "activity.toolClosed": "Tool closed",
    "activity.toolClosedMessage": "You can close this page now.",
    "activity.closeFailed": "Close failed",
    "api.requestFailed": "Request failed ({status})",
    "summary.off": "Base {speed}× · Gold {gold}× · Turbo off",
    "summary.on": "Base {speed}× · Gold {gold}× · {side} Shift Turbo {multiplier}×",
    "summary.side.left": "Left",
    "summary.side.right": "Right",
    "summary.combined": "Base {speed}× · Gold {gold}× · {turbo} · {focus}",
    "summary.turboOn": "{side} Shift Turbo {multiplier}×",
    "summary.turboOff": "Turbo off",
    "summary.focusOn": "{side} Ctrl Focus {target}×",
    "summary.focusOff": "Focus off",
    "summary.zoomOff": "Movement zoom will be disabled; the original can be restored precisely at any time.",
    "summary.zoomOn": "Original movement zoom will remain; the original can be restored precisely at any time.",
    "preflight.summary.NODE_RUNTIME": "Node.js runtime",
    "preflight.summary.GAME_LAYOUT": "Game directory layout",
    "preflight.summary.SUPPORTED_ARCHIVE": "Supported game build",
    "preflight.summary.ORIGINAL_BACKUP": "Original backup",
    "preflight.summary.GAME_PROCESS": "Game process",
    "preflight.summary.GAME_DIRECTORY_WRITE": "Game resource permissions",
    "preflight.summary.GAME_DIRECTORY_SPACE": "Game disk space",
    "preflight.summary.STATE_DIRECTORY_WRITE": "Backup directory permissions",
    "preflight.summary.STATE_DIRECTORY_SPACE": "Backup disk space",
    "preflight.summary.TEMP_DIRECTORY_SPACE": "Temporary directory space",
    "preflight.detail.nodeReady": "Node.js {version} meets the requirement.",
    "preflight.detail.nodeRequired": "Node.js {minimum} or newer is required.",
    "preflight.detail.layoutReady": "Found the game executable and assets.dat.",
    "preflight.detail.layoutMissing": "SolCesto.exe or www\\assets.dat is missing.",
    "preflight.detail.archiveOriginal": "Recognized the Epic 1.01.4b original archive.",
    "preflight.detail.archiveMod": "Recognized a registered Epic 1.01.4b Fast Cesto archive.",
    "preflight.detail.archiveUnknown": "The current archive is not a registered original or Fast Cesto build.",
    "preflight.detail.backupReady": "The original backup hash is valid.",
    "preflight.detail.backupMissing": "A Mod is installed but no valid original backup is available.",
    "preflight.detail.backupWillCreate": "The original backup will be created and verified during first install.",
    "preflight.detail.gameRunning": "Sol Cesto is running; close it completely first.",
    "preflight.detail.gameStopped": "No running game process was detected.",
    "preflight.detail.writable": "The directory is writable.",
    "preflight.detail.notWritable": "The directory is not writable; check permissions.",
    "preflight.detail.spaceReady": "Available disk space is sufficient.",
    "preflight.detail.spaceLow": "Available disk space is insufficient.",
    "preflight.detail.spaceUnknown": "Could not read available disk space.",
    "preflight.detail.directoryMissing": "The game resource directory does not exist."
  },
  "zh-CN": {
    "app.subtitle": "本地、可恢复的节奏与进度 QoL 配置工具",
    "status.checking": "正在检查",
    "notice.label": "隐私说明",
    "notice.prefix": "所有处理均在本机完成。",
    "notice.text": "工具不会联网、读取存档或上传游戏文件；应用配置前请关闭游戏。",
    "step.location": "01 · 位置",
    "heading.gameDirectory": "确认游戏目录",
    "action.refresh": "刷新状态",
    "field.gameDirectory": "SolCesto 目录",
    "field.gameDirectoryHelp.before": "目录内应包含",
    "field.gameDirectoryHelp.and": "和",
    "details.advanced": "高级：备份与状态目录",
    "field.stateDirectory": "状态目录",
    "preflight.title": "Alpha 兼容性预检",
    "preflight.help": "只读检查版本、权限、空间、备份和游戏进程",
    "preflight.waiting": "等待检查",
    "preflight.collecting": "正在收集环境信息…",
    "preflight.changeRefresh": "修改目录后请刷新状态。",
    "preflight.readyWarnings": "可用，有提示",
    "preflight.ready": "可以安装",
    "preflight.blocking": "{count} 项阻止",
    "step.experience": "02 · 体验",
    "heading.basePace": "选择基础节奏",
    "legend.baseSpeed": "基础速度",
    "speed.original": "原版",
    "speed.gentle": "温和",
    "speed.recommended": "推荐",
    "speed.fast": "快速",
    "zoom.title": "关闭行动镜头 Zoom",
    "zoom.help": "只移除行动时反复放大的镜头 Tween",
    "step.progress": "03 · 进度",
    "heading.goldMultiplier": "永久金币倍率",
    "gold.hint": "只影响未来获得的永久金币，不修改已有余额或购买价格。",
    "legend.goldMultiplier": "金币倍率",
    "gold.recommended": "2× 推荐",
    "step.turbo": "04 · 临时速度",
    "heading.turbo": "按住 Turbo",
    "field.key": "按键",
    "key.leftShift": "左 Shift",
    "key.rightShift": "右 Shift",
    "field.extraMultiplier": "额外乘数",
    "heading.focus": "按住减速",
    "focus.help": "在炸弹、陷阱等需要反应的场景临时放慢游戏",
    "key.leftControl": "左 Ctrl",
    "key.rightControl": "右 Ctrl",
    "field.targetSpeed": "目标速度",
    "step.apply": "05 · 应用",
    "confirm.gameClosed": "我已关闭游戏",
    "action.apply": "应用配置",
    "action.restore": "恢复原版",
    "activity.ready": "准备就绪",
    "activity.reading": "正在读取当前安装状态。",
    "action.diagnostic": "下载脱敏诊断报告",
    "footer.label": "Fast Cesto 公开 Alpha · 非官方工具",
    "action.shutdown": "关闭工具",
    "activity.processing": "处理中",
    "busy.wait": "正在处理，请稍候…",
    "busy.reading": "正在读取归档哈希与备份状态…",
    "busy.connecting": "正在连接本地补丁器…",
    "busy.installing": "正在生成、验证并交换本地归档…",
    "busy.restoring": "正在验证备份并恢复原版归档…",
    "busy.diagnostic": "正在生成不含路径、存档和游戏资源的报告…",
    "status.unrecognized": "无法识别",
    "status.installed": "已安装 Mod",
    "status.original": "原版",
    "status.unknown": "未知版本",
    "status.gameRunning": "游戏正在运行",
    "value.valid": "有效",
    "value.invalid": "异常",
    "activity.statusRefreshed": "状态已刷新",
    "activity.installedState": "备份{backup}，配置状态{manifest}。",
    "activity.detectedOriginal": "检测到受支持的 Epic 1.01.4b 原版归档。",
    "activity.unsupportedArchive": "当前归档不属于已登记的原版或 Fast Cesto 版本。",
    "activity.cannotReadStatus": "无法读取状态",
    "activity.readyMessage": "选择配置后即可应用。当前操作只发生在本机。",
    "activity.closeGame": "请先关闭游戏。",
    "activity.confirmDirectory": "需要确认目录",
    "activity.directoryNotFound": "未找到游戏目录。",
    "activity.initializationFailed": "界面初始化失败",
    "activity.configurationApplied": "配置已应用",
    "activity.alreadyInstalled": "当前已经是这套配置，文件没有被重写。",
    "activity.archiveApplied": "新归档已通过哈希验证，原版备份保持有效。",
    "activity.applyFailed": "应用失败",
    "activity.notConfirmed": "尚未确认",
    "activity.confirmClosedFirst": "请先勾选“我已关闭游戏”。",
    "confirm.restore": "恢复原版会关闭当前 Mod 功能，但不会改动存档或已获得金币。继续吗？",
    "activity.originalRestored": "已恢复原版",
    "activity.restoreMessage": "归档已恢复到受支持原版哈希。已获得的金币不会回滚。",
    "activity.restoreFailed": "恢复失败",
    "activity.diagnosticDownloaded": "诊断报告已下载",
    "activity.diagnosticMessage": "报告只包含版本、哈希、配置枚举和脱敏操作结果。",
    "activity.diagnosticFailed": "诊断导出失败",
    "activity.toolClosed": "工具已关闭",
    "activity.toolClosedMessage": "现在可以关闭此页面。",
    "activity.closeFailed": "关闭失败",
    "api.requestFailed": "请求失败（{status}）",
    "summary.off": "基础 {speed}× · 金币 {gold}× · Turbo 关闭",
    "summary.on": "基础 {speed}× · 金币 {gold}× · {side} Shift Turbo {multiplier}×",
    "summary.side.left": "左",
    "summary.side.right": "右",
    "summary.combined": "基础 {speed}× · 金币 {gold}× · {turbo} · {focus}",
    "summary.turboOn": "{side} Shift Turbo {multiplier}×",
    "summary.turboOff": "Turbo 关闭",
    "summary.focusOn": "{side} Ctrl 减速 {target}×",
    "summary.focusOff": "减速关闭",
    "summary.zoomOff": "行动 Zoom 将关闭；可随时精确恢复原版。",
    "summary.zoomOn": "保留原版行动 Zoom；可随时精确恢复原版。",
    "preflight.summary.NODE_RUNTIME": "Node.js 运行环境",
    "preflight.summary.GAME_LAYOUT": "游戏目录结构",
    "preflight.summary.SUPPORTED_ARCHIVE": "受支持的游戏构建",
    "preflight.summary.ORIGINAL_BACKUP": "原版备份",
    "preflight.summary.GAME_PROCESS": "游戏进程",
    "preflight.summary.GAME_DIRECTORY_WRITE": "游戏资源目录权限",
    "preflight.summary.GAME_DIRECTORY_SPACE": "游戏磁盘空间",
    "preflight.summary.STATE_DIRECTORY_WRITE": "备份目录权限",
    "preflight.summary.STATE_DIRECTORY_SPACE": "备份磁盘空间",
    "preflight.summary.TEMP_DIRECTORY_SPACE": "临时目录空间",
    "preflight.detail.nodeReady": "Node.js {version} 满足要求。",
    "preflight.detail.nodeRequired": "需要 Node.js {minimum} 或更新版本。",
    "preflight.detail.layoutReady": "已找到游戏程序和 assets.dat。",
    "preflight.detail.layoutMissing": "目录中缺少 SolCesto.exe 或 www\\assets.dat。",
    "preflight.detail.archiveOriginal": "已识别 Epic 1.01.4b 原版归档。",
    "preflight.detail.archiveMod": "已识别登记过的 Epic 1.01.4b Fast Cesto 归档。",
    "preflight.detail.archiveUnknown": "当前归档不属于已登记的原版或 Fast Cesto 版本。",
    "preflight.detail.backupReady": "原版备份哈希有效。",
    "preflight.detail.backupMissing": "已安装 Mod，但缺少有效原版备份。",
    "preflight.detail.backupWillCreate": "首次安装时将创建并验证原版备份。",
    "preflight.detail.gameRunning": "Sol Cesto 正在运行，请先完全关闭游戏。",
    "preflight.detail.gameStopped": "未检测到运行中的游戏。",
    "preflight.detail.writable": "目录可写。",
    "preflight.detail.notWritable": "目录不可写，请检查权限。",
    "preflight.detail.spaceReady": "可用空间充足。",
    "preflight.detail.spaceLow": "可用空间不足。",
    "preflight.detail.spaceUnknown": "无法读取磁盘空间。",
    "preflight.detail.directoryMissing": "游戏资源目录不存在。"
  }
});

export function normalizeLanguage(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  return null;
}

export function chooseInitialLanguage(storedLanguage, browserLanguages = []) {
  const stored = SUPPORTED_LANGUAGES.includes(storedLanguage) ? storedLanguage : null;
  if (stored) return stored;
  for (const candidate of browserLanguages) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) return normalized;
  }
  return DEFAULT_LANGUAGE;
}

export function translate(language, key, parameters = {}) {
  const dictionary = translations[SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE];
  const template = dictionary[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (match, name) => (
    Object.hasOwn(parameters, name) ? String(parameters[name]) : match
  ));
}

function diskDetail(language, check) {
  if (check.requiredBytes == null) return translate(language, "preflight.detail.directoryMissing");
  if (check.availableBytes == null) return translate(language, "preflight.detail.spaceUnknown");
  return translate(language, check.status === "pass" ? "preflight.detail.spaceReady" : "preflight.detail.spaceLow");
}

export function translatePreflightCheck(language, check, nodeVersion = "") {
  const summary = translate(language, `preflight.summary.${check.id}`);
  let detail;
  switch (check.id) {
    case "NODE_RUNTIME":
      detail = translate(language, check.status === "pass" ? "preflight.detail.nodeReady" : "preflight.detail.nodeRequired", {
        version: nodeVersion || check.detectedMajor || "",
        minimum: check.minimumMajor || 20,
      });
      break;
    case "GAME_LAYOUT":
      detail = translate(language, check.status === "pass" ? "preflight.detail.layoutReady" : "preflight.detail.layoutMissing");
      break;
    case "SUPPORTED_ARCHIVE":
      detail = translate(language, check.state === "original"
        ? "preflight.detail.archiveOriginal"
        : check.state === "installed"
          ? "preflight.detail.archiveMod"
          : "preflight.detail.archiveUnknown");
      break;
    case "ORIGINAL_BACKUP":
      detail = translate(language, check.valid
        ? "preflight.detail.backupReady"
        : check.willCreateOnInstall
          ? "preflight.detail.backupWillCreate"
          : "preflight.detail.backupMissing");
      break;
    case "GAME_PROCESS":
      detail = translate(language, check.running ? "preflight.detail.gameRunning" : "preflight.detail.gameStopped");
      break;
    case "GAME_DIRECTORY_WRITE":
    case "STATE_DIRECTORY_WRITE":
      detail = translate(language, check.writable ? "preflight.detail.writable" : "preflight.detail.notWritable");
      break;
    case "GAME_DIRECTORY_SPACE":
    case "STATE_DIRECTORY_SPACE":
    case "TEMP_DIRECTORY_SPACE":
      detail = diskDetail(language, check);
      break;
    default:
      detail = typeof check.detail === "string" ? check.detail : "";
  }
  return { summary, detail };
}
