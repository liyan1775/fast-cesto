const token = document.querySelector('meta[name="fast-cesto-token"]').content;
const $ = (selector) => document.querySelector(selector);
const gameDirectory = $("#gameDirectory");
const stateDirectory = $("#stateDirectory");
const statusBadge = $("#statusBadge");
const activityDot = $("#activityDot");
const activityTitle = $("#activityTitle");
const activityMessage = $("#activityMessage");
const gameClosed = $("#gameClosed");
const applyButton = $("#applyButton");
const turboEnabled = $("#turboEnabled");
const turboSettings = $("#turboSettings");
let latestPreflight = null;

async function api(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fast-Cesto-Token": token,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  return response;
}

function paths() {
  return { gameDirectory: gameDirectory.value.trim(), stateDirectory: stateDirectory.value.trim() };
}

function settings() {
  return {
    speed: Number(document.querySelector('input[name="speed"]:checked').value),
    disableMovementZoom: $("#disableMovementZoom").checked,
    goldMultiplier: Number(document.querySelector('input[name="gold"]:checked').value),
    turbo: {
      enabled: turboEnabled.checked,
      key: $("#turboKey").value,
      multiplier: Number($("#turboMultiplier").value),
    },
  };
}

function setActivity(kind, title, message) {
  activityDot.className = `activity-dot ${kind}`;
  activityTitle.textContent = title;
  activityMessage.textContent = message;
}

function setBusy(value, message = "正在处理，请稍候…") {
  document.body.classList.toggle("busy", value);
  if (value) setActivity("", "处理中", message);
  updateApplyState();
}

function describeStatus(status) {
  statusBadge.className = `status-badge ${status?.state || "unknown"}`;
  if (!status) {
    statusBadge.lastChild.textContent = "无法识别";
    return;
  }
  const names = { installed: "已安装 Mod", original: "原版", unknown: "未知版本" };
  statusBadge.lastChild.textContent = status.gameRunning
    ? "游戏正在运行"
    : names[status.state] || status.state;
  if (status.gameRunning) statusBadge.className = "status-badge error";
}

function renderPreflight(preflight) {
  latestPreflight = preflight;
  const output = $("#preflightStatus");
  const list = $("#preflightChecks");
  if (!preflight) {
    output.className = "preflight-status pending";
    output.textContent = "等待检查";
    list.innerHTML = '<li class="pending"><span></span>修改目录后请刷新状态。</li>';
    updateApplyState();
    return;
  }
  output.className = `preflight-status ${preflight.readyToInstall ? "ready" : "blocked"}`;
  output.textContent = preflight.readyToInstall
    ? preflight.warningIds.length ? "可用，有提示" : "可以安装"
    : `${preflight.blockingIssueIds.length} 项阻止`;
  list.replaceChildren(...preflight.checks.map((check) => {
    const item = document.createElement("li");
    item.className = check.status;
    const dot = document.createElement("span");
    const text = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = check.summary;
    const detail = document.createElement("div");
    detail.textContent = check.detail;
    text.append(strong, detail);
    item.append(dot, text);
    return item;
  }));
  updateApplyState();
}

function selectRadio(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${CSS.escape(String(value))}"]`);
  if (input) input.checked = true;
}

function applyConfigToForm(config) {
  if (!config) return;
  selectRadio("speed", config.speed);
  selectRadio("gold", config.goldMultiplier);
  $("#disableMovementZoom").checked = config.disableMovementZoom;
  turboEnabled.checked = config.turbo.enabled;
  $("#turboKey").value = config.turbo.key;
  $("#turboMultiplier").value = String(config.turbo.multiplier);
  renderSummary();
}

function renderSummary() {
  const value = settings();
  turboSettings.classList.toggle("disabled", !value.turbo.enabled);
  const effective = value.turbo.enabled ? value.speed * value.turbo.multiplier : value.speed;
  $("#effectiveSpeed").textContent = value.turbo.enabled ? `${value.speed}× → ${effective}×` : `${value.speed}×`;
  $("#summaryTitle").textContent = `基础 ${value.speed}× · 金币 ${value.goldMultiplier}× · ${value.turbo.enabled ? `${value.turbo.key === "ShiftLeft" ? "左" : "右"} Shift Turbo ${value.turbo.multiplier}×` : "Turbo 关闭"}`;
  $("#summaryDetail").textContent = `${value.disableMovementZoom ? "行动 Zoom 将关闭" : "保留原版行动 Zoom"}；可随时精确恢复原版。`;
}

function updateApplyState() {
  applyButton.disabled = !gameClosed.checked
    || latestPreflight?.readyToInstall !== true
    || document.body.classList.contains("busy");
}

async function refreshStatus({ loadConfig = true } = {}) {
  setBusy(true, "正在读取归档哈希与备份状态…");
  try {
    const response = await api("/api/status", paths());
    const data = await response.json();
    describeStatus(data.status);
    renderPreflight(data.preflight);
    if (loadConfig && data.status.activeConfig) applyConfigToForm(data.status.activeConfig);
    const message = data.status.state === "installed"
      ? `备份${data.status.backupValid ? "有效" : "异常"}，配置状态${data.status.stateManifestValid ? "有效" : "异常"}。`
      : data.status.state === "original"
        ? "检测到受支持的 Epic 1.01.3 原版归档。"
        : "当前归档不属于已支持的原版或已登记 Mod。";
    setActivity(data.status.state === "unknown" ? "error" : "success", "状态已刷新", message);
  } catch (error) {
    describeStatus(null);
    renderPreflight(null);
    setActivity("error", "无法读取状态", error.message);
  } finally {
    setBusy(false);
  }
}

async function bootstrap() {
  setBusy(true, "正在连接本地补丁器…");
  try {
    const response = await api("/api/bootstrap", {});
    const data = await response.json();
    gameDirectory.value = data.defaults.gameDirectory;
    stateDirectory.value = data.defaults.stateDirectory;
    if (data.status) {
      describeStatus(data.status);
      renderPreflight(data.preflight);
      if (data.status.activeConfig) applyConfigToForm(data.status.activeConfig);
      setActivity("success", "准备就绪", data.status.gameRunning ? "请先关闭游戏。" : "选择配置后即可应用。当前操作只发生在本机。" );
    } else {
      describeStatus(null);
      renderPreflight(null);
      setActivity("error", "需要确认目录", data.error || "未找到游戏目录。" );
    }
  } catch (error) {
    describeStatus(null);
    renderPreflight(null);
    setActivity("error", "界面初始化失败", error.message);
  } finally {
    setBusy(false);
  }
}

document.querySelectorAll('input[name="speed"], input[name="gold"], #disableMovementZoom, #turboEnabled, #turboKey, #turboMultiplier').forEach((input) => input.addEventListener("change", renderSummary));
gameClosed.addEventListener("change", updateApplyState);
gameDirectory.addEventListener("input", () => renderPreflight(null));
stateDirectory.addEventListener("input", () => renderPreflight(null));
$("#refreshButton").addEventListener("click", () => refreshStatus());

applyButton.addEventListener("click", async () => {
  setBusy(true, "正在生成、验证并交换本地归档…");
  try {
    const response = await api("/api/install", { ...paths(), settings: settings() });
    const data = await response.json();
    describeStatus(data.status);
    renderPreflight(data.preflight);
    setActivity("success", "配置已应用", data.result.result === "already-installed" ? "当前已经是这套配置，文件没有被重写。" : "新归档已通过哈希验证，原版备份保持有效。" );
    gameClosed.checked = false;
  } catch (error) {
    setActivity("error", "应用失败", error.message);
  } finally {
    setBusy(false);
  }
});

$("#restoreButton").addEventListener("click", async () => {
  if (!gameClosed.checked) {
    setActivity("error", "尚未确认", "请先勾选“我已关闭游戏”。");
    return;
  }
  if (!window.confirm("恢复原版会关闭当前 Mod 功能，但不会改动存档或已获得金币。继续吗？")) return;
  setBusy(true, "正在验证备份并恢复原版归档…");
  try {
    const response = await api("/api/restore", paths());
    const data = await response.json();
    describeStatus(data.status);
    renderPreflight(data.preflight);
    setActivity("success", "已恢复原版", "归档已恢复到受支持原版哈希。已获得的金币不会回滚。" );
    gameClosed.checked = false;
  } catch (error) {
    setActivity("error", "恢复失败", error.message);
  } finally {
    setBusy(false);
  }
});

$("#diagnosticButton").addEventListener("click", async () => {
  setBusy(true, "正在生成不含路径、存档和游戏资源的报告…");
  try {
    const response = await api("/api/diagnostic", paths());
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "fast-cesto-diagnostic.json";
    link.click();
    URL.revokeObjectURL(url);
    setActivity("success", "诊断报告已下载", "报告只包含版本、哈希、配置枚举和脱敏操作结果。" );
  } catch (error) {
    setActivity("error", "诊断导出失败", error.message);
  } finally {
    setBusy(false);
  }
});

$("#shutdownButton").addEventListener("click", async () => {
  try {
    await api("/api/shutdown", {});
    setActivity("success", "工具已关闭", "现在可以关闭此页面。" );
  } catch (error) {
    setActivity("error", "关闭失败", error.message);
  }
});

renderSummary();
bootstrap();
