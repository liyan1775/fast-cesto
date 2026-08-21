import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPreflightReport } from "./fast-cesto-preflight.mjs";

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const root = mkdtempSync(join(tmpdir(), "fast-cesto-preflight-"));
const gameDirectory = join(root, "game");
const stateDirectory = join(root, "state");
mkdirSync(join(gameDirectory, "www"), { recursive: true });
mkdirSync(stateDirectory);
writeFileSync(join(gameDirectory, "SolCesto.exe"), "fake-executable", { flag: "wx" });
writeFileSync(join(gameDirectory, "www", "assets.dat"), "fake-archive", { flag: "wx" });

try {
  const unsupported = createPreflightReport({
    gameDirectory,
    stateDirectory,
    status: { state: "unknown", backupValid: false, gameRunning: false },
  });
  requireEqual(unsupported.readyToInstall, false, "unknown archive readiness");
  requireEqual(unsupported.blockingIssueIds.includes("SUPPORTED_ARCHIVE"), true, "unknown archive issue");
  requireEqual(unsupported.warningIds.includes("ORIGINAL_BACKUP"), true, "first backup warning");

  const installed = createPreflightReport({
    gameDirectory,
    stateDirectory,
    status: { state: "installed", gameVersion: "1.01.4b", backupValid: true, gameRunning: false },
  });
  requireEqual(installed.readyToInstall, true, "installed readiness");
  requireEqual(installed.blockingIssueIds.length, 0, "installed blocking count");

  const running = createPreflightReport({
    gameDirectory,
    stateDirectory,
    status: { state: "installed", gameVersion: "1.01.4b", backupValid: true, gameRunning: true },
  });
  requireEqual(running.readyToInstall, false, "running game readiness");
  requireEqual(running.blockingIssueIds.includes("GAME_PROCESS"), true, "running game issue");
  console.log(JSON.stringify({ result: "passed", checkCount: installed.checks.length }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
