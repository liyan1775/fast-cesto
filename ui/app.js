import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  chooseInitialLanguage,
  translate,
  translatePreflightCheck,
} from "/i18n.js";

const token = document.querySelector('meta[name="fast-cesto-token"]').content;
const $ = (selector) => document.querySelector(selector);
const gameDirectory = $("#gameDirectory");
const stateDirectory = $("#stateDirectory");
const statusBadge = $("#statusBadge");
const statusText = $("#statusText");
const activityDot = $("#activityDot");
const activityTitle = $("#activityTitle");
const activityMessage = $("#activityMessage");
const gameClosed = $("#gameClosed");
const applyButton = $("#applyButton");
const turboEnabled = $("#turboEnabled");
const turboSettings = $("#turboSettings");
const languageSelect = $("#languageSelect");
let currentLanguage = "en";
let latestStatus;
let latestPreflight;
let lastActivity = {
  kind: "",
  titleKey: "activity.ready",
  messageKey: "activity.reading",
  parameters: {},
};

function t(key, parameters = {}) {
  return translate(currentLanguage, key, parameters);
}

function readStoredLanguage() {
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { return null; }
}

function storeLanguage(language) {
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch {}
}

function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

function renderActivity() {
  activityDot.className = `activity-dot ${lastActivity.kind}`;
  activityTitle.textContent = t(lastActivity.titleKey, lastActivity.parameters);
  activityMessage.textContent = lastActivity.rawMessage
    ?? t(lastActivity.messageKey, lastActivity.parameters);
}

function renderStatus() {
  if (latestStatus === undefined) return;
  const status = latestStatus;
  statusBadge.className = `status-badge ${status?.state || "unknown"}`;
  if (!status) {
    statusText.textContent = t("status.unrecognized");
    return;
  }
  const names = {
    installed: t("status.installed"),
    original: t("status.original"),
    unknown: t("status.unknown"),
  };
  statusText.textContent = status.gameRunning
    ? t("status.gameRunning")
    : names[status.state] || status.state;
  if (status.gameRunning) statusBadge.className = "status-badge error";
}

function setLanguage(language, { persist = true } = {}) {
  currentLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : "en";
  document.documentElement.lang = currentLanguage;
  languageSelect.value = currentLanguage;
  if (persist) storeLanguage(currentLanguage);
  applyStaticTranslations();
  renderStatus();
  if (latestPreflight !== undefined) renderPreflight(latestPreflight);
  renderSummary();
  renderActivity();
}

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
    let message = t("api.requestFailed", { status: response.status });
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

function setActivity(kind, titleKey, messageKey, parameters = {}) {
  lastActivity = { kind, titleKey, messageKey, parameters };
  renderActivity();
}

function setActivityRaw(kind, titleKey, rawMessage) {
  lastActivity = { kind, titleKey, rawMessage, parameters: {} };
  renderActivity();
}

function setBusy(value, messageKey = "busy.wait") {
  document.body.classList.toggle("busy", value);
  if (value) setActivity("", "activity.processing", messageKey);
  updateApplyState();
}

function describeStatus(status) {
  latestStatus = status;
  renderStatus();
}

function renderPreflight(preflight) {
  latestPreflight = preflight;
  const output = $("#preflightStatus");
  const list = $("#preflightChecks");
  if (!preflight) {
    output.className = "preflight-status pending";
    output.textContent = t("preflight.waiting");
    const item = document.createElement("li");
    item.className = "pending";
    item.append(document.createElement("span"));
    const text = document.createElement("div");
    text.textContent = t("preflight.changeRefresh");
    item.append(text);
    list.replaceChildren(item);
    updateApplyState();
    return;
  }
  output.className = `preflight-status ${preflight.readyToInstall ? "ready" : "blocked"}`;
  output.textContent = preflight.readyToInstall
    ? preflight.warningIds.length ? t("preflight.readyWarnings") : t("preflight.ready")
    : t("preflight.blocking", { count: preflight.blockingIssueIds.length });
  list.replaceChildren(...preflight.checks.map((check) => {
    const item = document.createElement("li");
    item.className = check.status;
    const dot = document.createElement("span");
    const text = document.createElement("div");
    const strong = document.createElement("strong");
    const localized = translatePreflightCheck(currentLanguage, check);
    strong.textContent = localized.summary;
    const detail = document.createElement("div");
    detail.textContent = localized.detail;
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
  $("#summaryTitle").textContent = t(value.turbo.enabled ? "summary.on" : "summary.off", {
    speed: value.speed,
    gold: value.goldMultiplier,
    side: t(value.turbo.key === "ShiftLeft" ? "summary.side.left" : "summary.side.right"),
    multiplier: value.turbo.multiplier,
  });
  $("#summaryDetail").textContent = t(value.disableMovementZoom ? "summary.zoomOff" : "summary.zoomOn");
}

function updateApplyState() {
  applyButton.disabled = !gameClosed.checked
    || latestPreflight?.readyToInstall !== true
    || document.body.classList.contains("busy");
}

async function refreshStatus({ loadConfig = true } = {}) {
  setBusy(true, "busy.reading");
  try {
    const response = await api("/api/status", paths());
    const data = await response.json();
    describeStatus(data.status);
    renderPreflight(data.preflight);
    if (loadConfig && data.status.activeConfig) applyConfigToForm(data.status.activeConfig);
    const messageKey = data.status.state === "installed"
      ? "activity.installedState"
      : data.status.state === "original"
        ? "activity.detectedOriginal"
        : "activity.unsupportedArchive";
    setActivity(data.status.state === "unknown" ? "error" : "success", "activity.statusRefreshed", messageKey, {
      backup: t(data.status.backupValid ? "value.valid" : "value.invalid"),
      manifest: t(data.status.stateManifestValid ? "value.valid" : "value.invalid"),
    });
  } catch (error) {
    describeStatus(null);
    renderPreflight(null);
    setActivityRaw("error", "activity.cannotReadStatus", error.message);
  } finally {
    setBusy(false);
  }
}

async function bootstrap() {
  setBusy(true, "busy.connecting");
  try {
    const response = await api("/api/bootstrap", {});
    const data = await response.json();
    gameDirectory.value = data.defaults.gameDirectory;
    stateDirectory.value = data.defaults.stateDirectory;
    if (data.status) {
      describeStatus(data.status);
      renderPreflight(data.preflight);
      if (data.status.activeConfig) applyConfigToForm(data.status.activeConfig);
      setActivity("success", "activity.ready", data.status.gameRunning ? "activity.closeGame" : "activity.readyMessage");
    } else {
      describeStatus(null);
      renderPreflight(null);
      if (data.error) setActivityRaw("error", "activity.confirmDirectory", data.error);
      else setActivity("error", "activity.confirmDirectory", "activity.directoryNotFound");
    }
  } catch (error) {
    describeStatus(null);
    renderPreflight(null);
    setActivityRaw("error", "activity.initializationFailed", error.message);
  } finally {
    setBusy(false);
  }
}

document.querySelectorAll('input[name="speed"], input[name="gold"], #disableMovementZoom, #turboEnabled, #turboKey, #turboMultiplier').forEach((input) => input.addEventListener("change", renderSummary));
languageSelect.addEventListener("change", () => setLanguage(languageSelect.value));
gameClosed.addEventListener("change", updateApplyState);
gameDirectory.addEventListener("input", () => renderPreflight(null));
stateDirectory.addEventListener("input", () => renderPreflight(null));
$("#refreshButton").addEventListener("click", () => refreshStatus());

applyButton.addEventListener("click", async () => {
  setBusy(true, "busy.installing");
  try {
    const response = await api("/api/install", { ...paths(), settings: settings() });
    const data = await response.json();
    describeStatus(data.status);
    renderPreflight(data.preflight);
    setActivity("success", "activity.configurationApplied", data.result.result === "already-installed" ? "activity.alreadyInstalled" : "activity.archiveApplied");
    gameClosed.checked = false;
  } catch (error) {
    setActivityRaw("error", "activity.applyFailed", error.message);
  } finally {
    setBusy(false);
  }
});

$("#restoreButton").addEventListener("click", async () => {
  if (!gameClosed.checked) {
    setActivity("error", "activity.notConfirmed", "activity.confirmClosedFirst");
    return;
  }
  if (!window.confirm(t("confirm.restore"))) return;
  setBusy(true, "busy.restoring");
  try {
    const response = await api("/api/restore", paths());
    const data = await response.json();
    describeStatus(data.status);
    renderPreflight(data.preflight);
    setActivity("success", "activity.originalRestored", "activity.restoreMessage");
    gameClosed.checked = false;
  } catch (error) {
    setActivityRaw("error", "activity.restoreFailed", error.message);
  } finally {
    setBusy(false);
  }
});

$("#diagnosticButton").addEventListener("click", async () => {
  setBusy(true, "busy.diagnostic");
  try {
    const response = await api("/api/diagnostic", paths());
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "fast-cesto-diagnostic.json";
    link.click();
    URL.revokeObjectURL(url);
    setActivity("success", "activity.diagnosticDownloaded", "activity.diagnosticMessage");
  } catch (error) {
    setActivityRaw("error", "activity.diagnosticFailed", error.message);
  } finally {
    setBusy(false);
  }
});

$("#shutdownButton").addEventListener("click", async () => {
  try {
    await api("/api/shutdown", {});
    setActivity("success", "activity.toolClosed", "activity.toolClosedMessage");
  } catch (error) {
    setActivityRaw("error", "activity.closeFailed", error.message);
  }
});

const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length
  ? navigator.languages
  : [navigator.language];
setLanguage(chooseInitialLanguage(readStoredLanguage(), browserLanguages), { persist: false });
bootstrap();
