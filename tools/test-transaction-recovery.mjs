import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { recoverInterruptedTransaction } from "./fast-cesto.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function write(path, value) {
  writeFileSync(path, value, { flag: "wx" });
}

function makeState(installedAssetsSha256, label) {
  return `${JSON.stringify({ installedAssetsSha256, label }, null, 2)}\n`;
}

function makeFixture(name) {
  const root = mkdtempSync(join(tmpdir(), `fast-cesto-recovery-${name}-`));
  const targetDirectory = join(root, "game");
  const stateDirectory = join(root, "state");
  mkdirSync(targetDirectory);
  mkdirSync(stateDirectory);
  const suffix = randomUUID();
  return {
    root,
    targetPath: join(targetDirectory, "assets.dat"),
    statePath: join(stateDirectory, "install-state.json"),
    transactionPath: join(stateDirectory, "transaction.json"),
    archiveStagePath: join(targetDirectory, `.fast-cesto-stage-${suffix}.dat`),
    archiveSwapPath: join(targetDirectory, `.fast-cesto-swap-${suffix}.dat`),
    stateStagePath: join(stateDirectory, `.fast-cesto-state-${suffix}.json`),
    stateSwapPath: join(stateDirectory, `.fast-cesto-state-swap-${suffix}.json`),
  };
}

function writeJournal(fixture, operation, oldArchive, newArchive, oldState, newState) {
  const journal = {
    schemaVersion: 1,
    operation,
    oldAssetsSha256: sha256(oldArchive),
    newAssetsSha256: sha256(newArchive),
    archiveStageName: fixture.archiveStagePath.split(/[\\/]/).at(-1),
    archiveSwapName: fixture.archiveSwapPath.split(/[\\/]/).at(-1),
  };
  if (operation === "install") {
    Object.assign(journal, {
      oldStateSha256: oldState === null ? null : sha256(oldState),
      newStateSha256: sha256(newState),
      stateStageName: fixture.stateStagePath.split(/[\\/]/).at(-1),
      stateSwapName: fixture.stateSwapPath.split(/[\\/]/).at(-1),
    });
  }
  write(fixture.transactionPath, `${JSON.stringify(journal, null, 2)}\n`);
}

async function runCase(name, arrange, expectedOutcome, verify) {
  const fixture = makeFixture(name);
  try {
    const oldArchive = Buffer.from(`old-archive-${name}`);
    const newArchive = Buffer.from(`new-archive-${name}`);
    const oldState = makeState(sha256(oldArchive), `old-${name}`);
    const newState = makeState(sha256(newArchive), `new-${name}`);
    arrange(fixture, { oldArchive, newArchive, oldState, newState });
    const result = await recoverInterruptedTransaction({
      targetPath: fixture.targetPath,
      statePath: fixture.statePath,
      transactionPath: fixture.transactionPath,
    });
    requireEqual(result.outcome, expectedOutcome, `${name} outcome`);
    requireEqual(existsSync(fixture.transactionPath), false, `${name} journal cleanup`);
    await verify(fixture, { oldArchive, newArchive, oldState, newState });
    return { name, outcome: result.outcome };
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

const results = [];

results.push(await runCase(
  "prepared",
  (f, v) => {
    write(f.targetPath, v.oldArchive);
    write(f.archiveStagePath, v.newArchive);
    write(f.statePath, v.oldState);
    write(f.stateStagePath, v.newState);
    writeJournal(f, "install", v.oldArchive, v.newArchive, v.oldState, v.newState);
  },
  "rolled-back",
  async (f, v) => {
    requireEqual(sha256(readFileSync(f.targetPath)), sha256(v.oldArchive), "prepared archive");
    requireEqual(sha256(readFileSync(f.statePath)), sha256(v.oldState), "prepared state");
    requireEqual(existsSync(f.archiveStagePath), false, "prepared archive stage cleanup");
    requireEqual(existsSync(f.stateStagePath), false, "prepared state stage cleanup");
  },
));

results.push(await runCase(
  "old-moved",
  (f, v) => {
    write(f.archiveSwapPath, v.oldArchive);
    write(f.archiveStagePath, v.newArchive);
    write(f.statePath, v.oldState);
    write(f.stateStagePath, v.newState);
    writeJournal(f, "install", v.oldArchive, v.newArchive, v.oldState, v.newState);
  },
  "rolled-back",
  async (f, v) => {
    requireEqual(sha256(readFileSync(f.targetPath)), sha256(v.oldArchive), "old-moved archive");
    requireEqual(sha256(readFileSync(f.statePath)), sha256(v.oldState), "old-moved state");
  },
));

results.push(await runCase(
  "new-archive-only",
  (f, v) => {
    write(f.targetPath, v.newArchive);
    write(f.archiveSwapPath, v.oldArchive);
    write(f.statePath, v.oldState);
    write(f.stateStagePath, v.newState);
    writeJournal(f, "install", v.oldArchive, v.newArchive, v.oldState, v.newState);
  },
  "committed",
  async (f, v) => {
    requireEqual(sha256(readFileSync(f.targetPath)), sha256(v.newArchive), "new-only archive");
    requireEqual(sha256(readFileSync(f.statePath)), sha256(v.newState), "new-only state");
    requireEqual(existsSync(f.archiveSwapPath), false, "new-only archive swap cleanup");
    requireEqual(existsSync(f.stateSwapPath), false, "new-only state swap cleanup");
  },
));

results.push(await runCase(
  "committed-not-cleaned",
  (f, v) => {
    write(f.targetPath, v.newArchive);
    write(f.archiveSwapPath, v.oldArchive);
    write(f.statePath, v.newState);
    write(f.stateSwapPath, v.oldState);
    writeJournal(f, "install", v.oldArchive, v.newArchive, v.oldState, v.newState);
  },
  "committed",
  async (f, v) => {
    requireEqual(sha256(readFileSync(f.targetPath)), sha256(v.newArchive), "committed archive");
    requireEqual(sha256(readFileSync(f.statePath)), sha256(v.newState), "committed state");
    requireEqual(existsSync(f.archiveSwapPath), false, "committed archive swap cleanup");
    requireEqual(existsSync(f.stateSwapPath), false, "committed state swap cleanup");
  },
));

results.push(await runCase(
  "first-install-new-archive",
  (f, v) => {
    write(f.targetPath, v.newArchive);
    write(f.archiveSwapPath, v.oldArchive);
    write(f.stateStagePath, v.newState);
    writeJournal(f, "install", v.oldArchive, v.newArchive, null, v.newState);
  },
  "committed",
  async (f, v) => {
    requireEqual(sha256(readFileSync(f.targetPath)), sha256(v.newArchive), "first-install archive");
    requireEqual(sha256(readFileSync(f.statePath)), sha256(v.newState), "first-install state");
    requireEqual(existsSync(f.archiveSwapPath), false, "first-install archive swap cleanup");
  },
));

results.push(await runCase(
  "restore-committed",
  (f, v) => {
    write(f.targetPath, v.newArchive);
    write(f.archiveSwapPath, v.oldArchive);
    writeJournal(f, "restore", v.oldArchive, v.newArchive, null, null);
  },
  "committed",
  async (f, v) => {
    requireEqual(sha256(readFileSync(f.targetPath)), sha256(v.newArchive), "restore archive");
    requireEqual(existsSync(f.archiveSwapPath), false, "restore swap cleanup");
  },
));

results.push(await runCase(
  "restore-old-moved",
  (f, v) => {
    write(f.archiveSwapPath, v.oldArchive);
    write(f.archiveStagePath, v.newArchive);
    writeJournal(f, "restore", v.oldArchive, v.newArchive, null, null);
  },
  "rolled-back",
  async (f, v) => {
    requireEqual(sha256(readFileSync(f.targetPath)), sha256(v.oldArchive), "restore rollback archive");
    requireEqual(existsSync(f.archiveStagePath), false, "restore rollback stage cleanup");
  },
));

{
  const fixture = makeFixture("unsafe-journal");
  try {
    const oldArchive = Buffer.from("old-unsafe");
    const newArchive = Buffer.from("new-unsafe");
    write(fixture.targetPath, oldArchive);
    write(fixture.transactionPath, JSON.stringify({
      schemaVersion: 1,
      operation: "restore",
      oldAssetsSha256: sha256(oldArchive),
      newAssetsSha256: sha256(newArchive),
      archiveStageName: "../outside.dat",
      archiveSwapName: ".fast-cesto-swap-safe.dat",
    }));
    let rejected = false;
    try {
      await recoverInterruptedTransaction({
        targetPath: fixture.targetPath,
        statePath: fixture.statePath,
        transactionPath: fixture.transactionPath,
      });
    } catch {
      rejected = true;
    }
    requireEqual(rejected, true, "unsafe journal rejected");
    requireEqual(sha256(readFileSync(fixture.targetPath)), sha256(oldArchive), "unsafe target unchanged");
    results.push({ name: "unsafe-journal", outcome: "rejected" });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

{
  const fixture = makeFixture("command-safety");
  const cliPath = fileURLToPath(new URL("./fast-cesto.mjs", import.meta.url));
  const gameDirectory = join(fixture.root, "command-game");
  const gameAssetsDirectory = join(gameDirectory, "www");
  const stateDirectory = join(fixture.root, "command-state");
  const lockPath = join(stateDirectory, "operation.lock");
  mkdirSync(gameAssetsDirectory, { recursive: true });
  mkdirSync(stateDirectory, { recursive: true });
  write(join(gameAssetsDirectory, "assets.dat"), Buffer.from("unknown-test-archive"));
  try {
    write(lockPath, `${JSON.stringify({ pid: process.pid, nonce: "active-test" })}\n`);
    const activeLock = spawnSync(
      process.execPath,
      [cliPath, "status", gameDirectory, stateDirectory],
      { encoding: "utf8", windowsHide: true },
    );
    requireEqual(activeLock.status, 1, "active operation lock exit code");
    requireEqual(
      activeLock.stderr.includes("Another Fast Cesto operation"),
      true,
      "active operation lock message",
    );

    unlinkSync(lockPath);
    write(lockPath, `${JSON.stringify({ pid: 2147483647, nonce: "stale-test" })}\n`);
    const orphanStageName = `.fast-cesto-stage-${randomUUID()}.dat`;
    write(join(gameAssetsDirectory, orphanStageName), Buffer.from("orphan-stage"));
    const staleLock = spawnSync(
      process.execPath,
      [cliPath, "status", gameDirectory, stateDirectory],
      { encoding: "utf8", windowsHide: true },
    );
    requireEqual(staleLock.status, 0, "stale operation lock exit code");
    requireEqual(existsSync(lockPath), false, "stale operation lock cleanup");
    requireEqual(existsSync(join(gameAssetsDirectory, orphanStageName)), false, "orphan stage cleanup");
    const staleStatus = JSON.parse(staleLock.stdout);
    requireEqual(
      staleStatus.removedOrphanStages.includes(orphanStageName),
      true,
      "orphan stage reported",
    );

    const orphanSwapName = `.fast-cesto-swap-${randomUUID()}.dat`;
    const orphanSwapPath = join(gameAssetsDirectory, orphanSwapName);
    write(orphanSwapPath, Buffer.from("orphan-swap"));
    const orphanSwap = spawnSync(
      process.execPath,
      [cliPath, "status", gameDirectory, stateDirectory],
      { encoding: "utf8", windowsHide: true },
    );
    requireEqual(orphanSwap.status, 1, "unjournaled swap exit code");
    requireEqual(
      orphanSwap.stderr.includes("Unjournaled archive swap requires manual inspection"),
      true,
      "unjournaled swap message",
    );
    requireEqual(existsSync(orphanSwapPath), true, "unjournaled swap preserved");
    requireEqual(existsSync(lockPath), false, "operation lock cleanup after refusal");
    results.push({ name: "command-safety", outcome: "passed" });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

console.log(JSON.stringify({ result: "passed", results }, null, 2));
