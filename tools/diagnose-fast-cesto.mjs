import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDiagnosticReport,
  recordOperation,
  writeDiagnosticReport,
} from "./fast-cesto-diagnostics.mjs";
import { createPreflightReport } from "./fast-cesto-preflight.mjs";

const [, , gameDirectoryArg, stateDirectoryArg, outputPathArg] = process.argv;
if (!gameDirectoryArg || !stateDirectoryArg || !outputPathArg) {
  console.error("Usage: node diagnose-fast-cesto.mjs <SolCesto-directory> <state-directory> <output-json>");
  process.exit(2);
}

const startedAt = Date.now();
const operationId = randomUUID();
const gameDirectory = resolve(gameDirectoryArg);
const stateDirectory = resolve(stateDirectoryArg);
const outputPath = resolve(outputPathArg);
const cliPath = fileURLToPath(new URL("./fast-cesto.mjs", import.meta.url));

try {
  const statusRun = spawnSync(
    process.execPath,
    [cliPath, "status", gameDirectory, stateDirectory],
    { encoding: "utf8", windowsHide: true },
  );
  if (statusRun.status !== 0) {
    throw new Error("Could not collect Fast Cesto status for the diagnostic report");
  }
  const status = JSON.parse(statusRun.stdout);
  const preflight = createPreflightReport({ gameDirectory, stateDirectory, status });
  const report = createDiagnosticReport({ status, stateDirectory, preflight });
  writeDiagnosticReport(outputPath, report);
  recordOperation(stateDirectory, {
    operationId,
    command: "diagnose",
    outcome: "success",
    result: "diagnostic-created",
    durationMs: Date.now() - startedAt,
    gameVersion: status.gameVersion,
    currentSha256: status.currentSha256,
    configuration: status.activeConfig,
    recovery: status.recovery,
  });
  console.log(JSON.stringify({ result: "diagnostic-created", outputPath }, null, 2));
} catch (error) {
  recordOperation(stateDirectory, {
    operationId,
    command: "diagnose",
    outcome: "error",
    durationMs: Date.now() - startedAt,
    error,
  });
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
