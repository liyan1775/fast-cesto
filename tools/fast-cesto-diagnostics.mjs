import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { arch, platform, release } from "node:os";
import { dirname, join } from "node:path";

const DIAGNOSTIC_SCHEMA_VERSION = 1;
const MAX_LOG_BYTES = 512 * 1024;
const MAX_LOG_LINE_BYTES = 16 * 1024;

function nestedErrorCode(error) {
  let current = error;
  while (current && typeof current === "object") {
    if (typeof current.code === "string") {
      return current.code;
    }
    current = current.cause;
  }
  return null;
}

export function classifyDiagnosticError(error) {
  const code = nestedErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  let category = "UNEXPECTED";
  if (code === "ENOSPC") category = "DISK_SPACE";
  else if (["EBUSY", "EPERM"].includes(code)) category = "FILE_IN_USE";
  else if (code === "EACCES") category = "PERMISSION";
  else if (code === "ENOENT") category = "MISSING_FILE";
  else if (/Close Sol Cesto/i.test(message)) category = "GAME_RUNNING";
  else if (/Another Fast Cesto operation/i.test(message)) category = "OPERATION_LOCKED";
  else if (/unknown assets\.dat|unknown current archive/i.test(message)) category = "UNSUPPORTED_ARCHIVE";
  else if (/transaction|swap|stage/i.test(message)) category = "TRANSACTION_SAFETY";
  else if (/config|schema|field|must be/i.test(message)) category = "INVALID_CONFIGURATION";
  else if (/backup/i.test(message)) category = "BACKUP_INVALID";
  return { category, code };
}

function cleanHash(value) {
  return typeof value === "string" && /^[0-9A-F]{64}$/i.test(value)
    ? value.toUpperCase()
    : null;
}

export function sanitizeConfiguration(config) {
  if (!config || typeof config !== "object") {
    return null;
  }
  return {
    schemaVersion: Number.isInteger(config.schemaVersion) ? config.schemaVersion : null,
    gameVersion: typeof config.gameVersion === "string" ? config.gameVersion : null,
    speed: typeof config.speed === "number" ? config.speed : null,
    disableMovementZoom: typeof config.disableMovementZoom === "boolean"
      ? config.disableMovementZoom
      : null,
    goldMultiplier: Number.isInteger(config.goldMultiplier) ? config.goldMultiplier : null,
    turbo: {
      enabled: typeof config.turbo?.enabled === "boolean" ? config.turbo.enabled : null,
      key: ["ShiftLeft", "ShiftRight"].includes(config.turbo?.key) ? config.turbo.key : null,
      multiplier: typeof config.turbo?.multiplier === "number"
        ? config.turbo.multiplier
        : null,
    },
    focus: {
      enabled: typeof config.focus?.enabled === "boolean" ? config.focus.enabled : null,
      key: ["ControlLeft", "ControlRight"].includes(config.focus?.key) ? config.focus.key : null,
      targetSpeed: typeof config.focus?.targetSpeed === "number"
        ? config.focus.targetSpeed
        : null,
    },
  };
}

export function operationLogPath(stateDirectory) {
  return join(stateDirectory, "operations.ndjson");
}

function rotateLogIfNeeded(logPath) {
  if (!existsSync(logPath) || statSync(logPath).size < MAX_LOG_BYTES) {
    return;
  }
  const previousPath = `${logPath}.1`;
  if (existsSync(previousPath)) {
    unlinkSync(previousPath);
  }
  renameSync(logPath, previousPath);
}

export function recordOperation(stateDirectory, event) {
  try {
    mkdirSync(stateDirectory, { recursive: true });
    const logPath = operationLogPath(stateDirectory);
    rotateLogIfNeeded(logPath);
    const normalized = {
      schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      operationId: typeof event.operationId === "string" ? event.operationId : randomUUID(),
      command: ["status", "install", "restore", "diagnose"].includes(event.command)
        ? event.command
        : "unknown",
      outcome: event.outcome === "success" ? "success" : "error",
      result: typeof event.result === "string" ? event.result : null,
      durationMs: Number.isFinite(event.durationMs) ? Math.max(0, Math.round(event.durationMs)) : null,
      gameVersion: typeof event.gameVersion === "string" ? event.gameVersion : null,
      currentSha256: cleanHash(event.currentSha256),
      configuration: sanitizeConfiguration(event.configuration),
      recovery: event.recovery && typeof event.recovery === "object"
        ? {
            result: typeof event.recovery.result === "string" ? event.recovery.result : null,
            operation: typeof event.recovery.operation === "string" ? event.recovery.operation : null,
            outcome: typeof event.recovery.outcome === "string" ? event.recovery.outcome : null,
          }
        : null,
      error: event.error ? classifyDiagnosticError(event.error) : null,
    };
    appendFileSync(logPath, `${JSON.stringify(normalized)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

function readLogFile(path, events, skipped) {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line) continue;
    if (Buffer.byteLength(line, "utf8") > MAX_LOG_LINE_BYTES) {
      skipped.count += 1;
      continue;
    }
    try {
      const event = JSON.parse(line);
      if (event?.schemaVersion !== DIAGNOSTIC_SCHEMA_VERSION) {
        skipped.count += 1;
        continue;
      }
      events.push(event);
    } catch {
      skipped.count += 1;
    }
  }
}

export function readRecentOperations(stateDirectory, limit = 50) {
  const boundedLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const events = [];
  const skipped = { count: 0 };
  const logPath = operationLogPath(stateDirectory);
  readLogFile(`${logPath}.1`, events, skipped);
  readLogFile(logPath, events, skipped);
  return {
    events: events.slice(-boundedLimit),
    skippedLineCount: skipped.count,
  };
}

function sanitizeStatus(status) {
  return {
    state: typeof status?.state === "string" ? status.state : "unavailable",
    currentSha256: cleanHash(status?.currentSha256),
    gameVersion: typeof status?.gameVersion === "string" ? status.gameVersion : null,
    backupValid: typeof status?.backupValid === "boolean" ? status.backupValid : null,
    backupSha256: cleanHash(status?.backupSha256),
    stateManifestValid: typeof status?.stateManifestValid === "boolean"
      ? status.stateManifestValid
      : null,
    gameRunning: typeof status?.gameRunning === "boolean" ? status.gameRunning : null,
    activeConfig: sanitizeConfiguration(status?.activeConfig),
    recovery: status?.recovery && typeof status.recovery === "object"
      ? {
          result: typeof status.recovery.result === "string" ? status.recovery.result : null,
          operation: typeof status.recovery.operation === "string" ? status.recovery.operation : null,
          outcome: typeof status.recovery.outcome === "string" ? status.recovery.outcome : null,
        }
      : null,
  };
}

function sanitizePreflight(preflight) {
  if (!preflight || typeof preflight !== "object") {
    return null;
  }
  const allowedIds = new Set([
    "NODE_RUNTIME",
    "GAME_LAYOUT",
    "SUPPORTED_ARCHIVE",
    "ORIGINAL_BACKUP",
    "GAME_PROCESS",
    "GAME_DIRECTORY_WRITE",
    "GAME_DIRECTORY_SPACE",
    "STATE_DIRECTORY_WRITE",
    "STATE_DIRECTORY_SPACE",
    "TEMP_DIRECTORY_SPACE",
  ]);
  const numericOrNull = (value) => Number.isFinite(value) ? value : null;
  return {
    schemaVersion: preflight.schemaVersion === 1 ? 1 : null,
    readyToInstall: preflight.readyToInstall === true,
    blockingIssueIds: Array.isArray(preflight.blockingIssueIds)
      ? preflight.blockingIssueIds.filter((id) => allowedIds.has(id))
      : [],
    warningIds: Array.isArray(preflight.warningIds)
      ? preflight.warningIds.filter((id) => allowedIds.has(id))
      : [],
    checks: Array.isArray(preflight.checks)
      ? preflight.checks
          .filter((check) => allowedIds.has(check?.id))
          .map((check) => ({
            id: check.id,
            status: ["pass", "warn", "block"].includes(check.status) ? check.status : "block",
            availableBytes: numericOrNull(check.availableBytes),
            requiredBytes: numericOrNull(check.requiredBytes),
            detectedMajor: numericOrNull(check.detectedMajor),
            minimumMajor: numericOrNull(check.minimumMajor),
            writable: typeof check.writable === "boolean" ? check.writable : null,
            running: typeof check.running === "boolean" ? check.running : null,
            valid: typeof check.valid === "boolean" ? check.valid : null,
          }))
      : [],
  };
}

export function createDiagnosticReport({ status, stateDirectory, preflight = null }) {
  const recent = readRecentOperations(stateDirectory, 50);
  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    product: "Fast Cesto internal alpha",
    generatedAt: new Date().toISOString(),
    privacy: {
      pathsIncluded: false,
      gameFilesIncluded: false,
      saveDataIncluded: false,
      epicConfigurationIncluded: false,
    },
    environment: {
      platform: platform(),
      architecture: arch(),
      osRelease: release(),
      nodeVersion: process.version,
    },
    status: sanitizeStatus(status),
    preflight: sanitizePreflight(preflight),
    recentOperations: recent.events,
    skippedLogLineCount: recent.skippedLineCount,
  };
}

export function writeDiagnosticReport(outputPath, report) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}
