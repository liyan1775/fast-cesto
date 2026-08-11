import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDiagnosticReport,
  operationLogPath,
  readRecentOperations,
  recordOperation,
  writeDiagnosticReport,
} from "./fast-cesto-diagnostics.mjs";

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const root = mkdtempSync(join(tmpdir(), "fast-cesto-diagnostics-"));
const privatePath = join(root, "Users", "tester", "Epic", "secret");
try {
  const config = {
    schemaVersion: 2,
    gameVersion: "1.01.3",
    speed: 1.5,
    disableMovementZoom: true,
    goldMultiplier: 2,
    turbo: { enabled: true, key: "ShiftLeft", multiplier: 2 },
    ignoredPrivatePath: privatePath,
  };
  requireEqual(recordOperation(root, {
    operationId: randomUUID(),
    command: "install",
    outcome: "success",
    result: "installed",
    durationMs: 42.4,
    gameVersion: "1.01.3",
    currentSha256: "A".repeat(64),
    configuration: config,
    recovery: { result: "none" },
  }), true, "record successful operation");
  requireEqual(recordOperation(root, {
    operationId: randomUUID(),
    command: "restore",
    outcome: "error",
    durationMs: 10,
    error: new Error(`Unknown failure at ${privatePath}`),
  }), true, "record error operation");

  writeFileSync(operationLogPath(root), "not-json\n", { encoding: "utf8", flag: "a" });
  const recent = readRecentOperations(root, 10);
  requireEqual(recent.events.length, 2, "valid operation count");
  requireEqual(recent.skippedLineCount, 1, "skipped operation count");
  requireEqual(recent.events[0].configuration.ignoredPrivatePath, undefined, "config whitelist");
  requireEqual(recent.events[1].error.category, "UNEXPECTED", "error category");

  const report = createDiagnosticReport({
    stateDirectory: root,
    preflight: {
      schemaVersion: 1,
      readyToInstall: false,
      blockingIssueIds: ["GAME_PROCESS", "UNRECOGNIZED_PRIVATE_CHECK"],
      warningIds: [],
      checks: [{
        id: "GAME_PROCESS",
        status: "block",
        summary: privatePath,
        detail: privatePath,
        running: true,
      }],
    },
    status: {
      state: "installed",
      currentSha256: "B".repeat(64),
      gameVersion: "1.01.3",
      backupValid: true,
      backupSha256: "C".repeat(64),
      stateManifestValid: true,
      gameRunning: false,
      activeConfig: config,
      recovery: { result: "none" },
      privatePath,
    },
  });
  const reportPath = join(root, "report.json");
  writeDiagnosticReport(reportPath, report);
  const serialized = readFileSync(reportPath, "utf8");
  requireEqual(existsSync(reportPath), true, "report created");
  requireEqual(serialized.includes(privatePath), false, "private path omitted");
  requireEqual(report.privacy.pathsIncluded, false, "privacy declaration");
  requireEqual(report.status.activeConfig.turbo.key, "ShiftLeft", "config retained");
  requireEqual(report.preflight.blockingIssueIds.length, 1, "preflight id whitelist");
  requireEqual(report.preflight.checks[0].running, true, "preflight boolean retained");
  requireEqual(report.preflight.checks[0].summary, undefined, "preflight text omitted");
  console.log(JSON.stringify({ result: "passed" }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
