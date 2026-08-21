import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  constants,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statfsSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED, patchData, patchRuntime } from "./build-prototype.mjs";
import { parseArchive, readEntry, repackArchive } from "./c3-asset-archive.mjs";
import { recordOperation } from "./fast-cesto-diagnostics.mjs";

const STATE_SCHEMA_VERSION = 1;
const CONFIG_SCHEMA_VERSION = 3;
const PATCH_IMPLEMENTATION_VERSION = 5;
const TRANSACTION_SCHEMA_VERSION = 1;
const MIN_FREE_SPACE_MARGIN_BYTES = 16 * 1024 * 1024;
const VALID_SPEEDS = new Set([1, 1.25, 1.5, 2]);
const VALID_GOLD_MULTIPLIERS = new Set([1, 2, 3]);
const VALID_TURBO_KEYS = new Set(["ShiftLeft", "ShiftRight"]);
const VALID_TURBO_MULTIPLIERS = new Set([1.5, 2, 3]);
const VALID_FOCUS_KEYS = new Set(["ControlLeft", "ControlRight"]);
const VALID_FOCUS_TARGET_SPEEDS = new Set([0.5, 0.75, 1]);
const DEFAULT_CONFIG_PATH = resolve("config", "fast-cesto.default.json");
const DEFAULT_STATE_DIRECTORY = resolve("backups", "epic-1.01.4b");

function findErrorCode(error) {
  let current = error;
  while (current && typeof current === "object") {
    if (typeof current.code === "string") {
      return current.code;
    }
    current = current.cause;
  }
  return null;
}

function formatErrorForUser(error) {
  const code = findErrorCode(error);
  if (code === "ENOSPC") {
    return "Not enough free disk space to safely build the patch. Free space and try again. (ENOSPC)";
  }
  if (["EBUSY", "EPERM"].includes(code)) {
    return `A game or patch file is in use. Close Sol Cesto and try again. (${code})`;
  }
  if (code === "EACCES") {
    return "Fast Cesto cannot write the game or backup directory. Check folder permissions and try again. (EACCES)";
  }
  if (code === "ENOENT") {
    return "A required game, backup, or transaction file is missing. Check the selected game directory. (ENOENT)";
  }
  return error instanceof Error ? error.stack : String(error);
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function isGameRunning() {
  if (process.platform !== "win32") {
    return false;
  }
  try {
    const output = execFileSync(
      "tasklist.exe",
      ["/FI", "IMAGENAME eq SolCesto.exe", "/FO", "CSV", "/NH"],
      { encoding: "utf8", windowsHide: true },
    );
    return output.toLowerCase().includes('"solcesto.exe"');
  } catch (error) {
    throw new Error("Could not check whether Sol Cesto is running", { cause: error });
  }
}

function acquireOperationLock(stateDirectory) {
  mkdirSync(stateDirectory, { recursive: true });
  const lockPath = join(stateDirectory, "operation.lock");
  if (existsSync(lockPath)) {
    let stale = false;
    try {
      const lock = readJson(lockPath, "Operation lock");
      stale = !isProcessRunning(lock?.pid);
    } catch {
      stale = true;
    }
    if (!stale) {
      throw new Error("Another Fast Cesto operation is already running");
    }
    unlinkSync(lockPath);
  }
  const nonce = randomUUID();
  try {
    writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, nonce, createdAt: new Date().toISOString() })}\n`, { flag: "wx" });
  } catch (error) {
    if (findErrorCode(error) === "EEXIST") {
      throw new Error("Another Fast Cesto operation acquired the lock first", { cause: error });
    }
    throw error;
  }
  return { lockPath, nonce };
}

function releaseOperationLock(lock) {
  if (!lock || !existsSync(lock.lockPath)) {
    return;
  }
  try {
    const current = readJson(lock.lockPath, "Operation lock");
    if (current?.nonce === lock.nonce) {
      unlinkSync(lock.lockPath);
    }
  } catch {
    // Leave an unexpected lock for the next invocation to classify as stale.
  }
}

export function ensureFreeSpace(directory, requiredBytes, label) {
  const stats = statfsSync(directory, { bigint: true });
  const availableBytes = stats.bavail * stats.bsize;
  const required = BigInt(Math.ceil(requiredBytes));
  if (availableBytes < required) {
    const error = new Error(
      `${label} requires ${required} bytes, but only ${availableBytes} bytes are available`,
    );
    error.code = "ENOSPC";
    throw error;
  }
  return availableBytes;
}

function usage() {
  console.error(`Usage:
  node fast-cesto.mjs status <SolCesto-directory> [state-directory]
  node fast-cesto.mjs install <SolCesto-directory> [config-file] [state-directory]
  node fast-cesto.mjs restore <SolCesto-directory> [state-directory]`);
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function sha256File(path) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolvePromise(hash.digest("hex").toUpperCase()));
  });
}

async function requireHash(path, expected, label) {
  const actual = await sha256File(path);
  if (actual !== expected) {
    throw new Error(`${label} hash mismatch: expected ${expected}, got ${actual}`);
  }
  return actual;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${path}`, { cause: error });
  }
}

export function validateConfig(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Config must be a JSON object");
  }
  if (![2, CONFIG_SCHEMA_VERSION].includes(candidate.schemaVersion)) {
    throw new Error(`Unsupported config schemaVersion: ${candidate.schemaVersion}`);
  }
  const expectedKeys = [
    "schemaVersion",
    "gameVersion",
    "speed",
    "disableMovementZoom",
    "goldMultiplier",
    "turbo",
    ...(candidate.schemaVersion === CONFIG_SCHEMA_VERSION ? ["focus"] : []),
  ];
  const actualKeys = Object.keys(candidate).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify([...expectedKeys].sort())) {
    throw new Error(`Config must contain exactly: ${expectedKeys.join(", ")}`);
  }
  if (candidate.gameVersion !== SUPPORTED.gameVersion) {
    throw new Error(`Unsupported gameVersion: ${candidate.gameVersion}`);
  }
  if (!VALID_SPEEDS.has(candidate.speed)) {
    throw new Error(`Unsupported speed: ${candidate.speed}`);
  }
  if (typeof candidate.disableMovementZoom !== "boolean") {
    throw new Error("disableMovementZoom must be true or false");
  }
  if (!VALID_GOLD_MULTIPLIERS.has(candidate.goldMultiplier)) {
    throw new Error(`Unsupported goldMultiplier: ${candidate.goldMultiplier}`);
  }
  if (!candidate.turbo || typeof candidate.turbo !== "object" || Array.isArray(candidate.turbo)) {
    throw new Error("turbo must be a JSON object");
  }
  const turboKeys = Object.keys(candidate.turbo).sort();
  const expectedTurboKeys = ["enabled", "key", "multiplier"].sort();
  if (JSON.stringify(turboKeys) !== JSON.stringify(expectedTurboKeys)) {
    throw new Error("turbo must contain exactly: enabled, key, multiplier");
  }
  if (typeof candidate.turbo.enabled !== "boolean") {
    throw new Error("turbo.enabled must be true or false");
  }
  if (!VALID_TURBO_KEYS.has(candidate.turbo.key)) {
    throw new Error(`Unsupported turbo.key: ${candidate.turbo.key}`);
  }
  if (!VALID_TURBO_MULTIPLIERS.has(candidate.turbo.multiplier)) {
    throw new Error(`Unsupported turbo.multiplier: ${candidate.turbo.multiplier}`);
  }
  const focus = candidate.schemaVersion === 2
    ? { enabled: false, key: "ControlLeft", targetSpeed: 0.5 }
    : candidate.focus;
  if (!focus || typeof focus !== "object" || Array.isArray(focus)) {
    throw new Error("focus must be a JSON object");
  }
  const focusKeys = Object.keys(focus).sort();
  const expectedFocusKeys = ["enabled", "key", "targetSpeed"].sort();
  if (JSON.stringify(focusKeys) !== JSON.stringify(expectedFocusKeys)) {
    throw new Error("focus must contain exactly: enabled, key, targetSpeed");
  }
  if (typeof focus.enabled !== "boolean") {
    throw new Error("focus.enabled must be true or false");
  }
  if (!VALID_FOCUS_KEYS.has(focus.key)) {
    throw new Error(`Unsupported focus.key: ${focus.key}`);
  }
  if (!VALID_FOCUS_TARGET_SPEEDS.has(focus.targetSpeed)) {
    throw new Error(`Unsupported focus.targetSpeed: ${focus.targetSpeed}`);
  }
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    gameVersion: candidate.gameVersion,
    speed: candidate.speed,
    disableMovementZoom: candidate.disableMovementZoom,
    goldMultiplier: candidate.goldMultiplier,
    turbo: {
      enabled: candidate.turbo.enabled,
      key: candidate.turbo.key,
      multiplier: candidate.turbo.multiplier,
    },
    focus: {
      enabled: focus.enabled,
      key: focus.key,
      targetSpeed: focus.targetSpeed,
    },
  };
}

function readState(statePath) {
  if (!existsSync(statePath)) {
    return null;
  }
  const state = readJson(statePath, "Install state");
  if (
    state?.schemaVersion !== STATE_SCHEMA_VERSION
    || state?.gameVersion !== SUPPORTED.gameVersion
    || state?.originalAssetsSha256 !== SUPPORTED.assetsSha256
    || typeof state?.installedAssetsSha256 !== "string"
  ) {
    throw new Error(`Install state is incompatible or incomplete: ${statePath}`);
  }
  return state;
}

export function classifyInstallState(currentSha256, state) {
  if (currentSha256 === SUPPORTED.assetsSha256) {
    return "original";
  }
  if (
    state?.originalAssetsSha256 === SUPPORTED.assetsSha256
    && state?.installedAssetsSha256 === currentSha256
  ) {
    return "installed";
  }
  return "unknown";
}

function assertOriginalInternals(archive) {
  const runtime = readEntry(archive, "scripts/c3runtime.js");
  const data = readEntry(archive, "data.json");
  if (sha256Buffer(runtime) !== SUPPORTED.runtimeSha256) {
    throw new Error("Original scripts/c3runtime.js hash does not match the supported build");
  }
  if (sha256Buffer(data) !== SUPPORTED.dataSha256) {
    throw new Error("Original data.json hash does not match the supported build");
  }
  return { runtime, data };
}

function makePayloadDirectory() {
  return mkdtempSync(join(tmpdir(), "fast-cesto-"));
}

function removePayloadDirectory(path) {
  const prefix = `${resolve(tmpdir())}${sep}fast-cesto-`;
  if (!resolve(path).startsWith(prefix)) {
    throw new Error(`Refusing to remove unexpected temporary directory: ${path}`);
  }
  rmSync(path, { recursive: true, force: true });
}

async function ensureOriginalBackup(targetPath, backupPath, state) {
  if (existsSync(backupPath)) {
    await requireHash(backupPath, SUPPORTED.assetsSha256, "Original backup");
    assertOriginalInternals(parseArchive(backupPath));
    return;
  }
  if (state !== "original") {
    throw new Error(`Verified original backup not found: ${backupPath}`);
  }
  mkdirSync(dirname(backupPath), { recursive: true });
  ensureFreeSpace(
    dirname(backupPath),
    statSync(targetPath).size + MIN_FREE_SPACE_MARGIN_BYTES,
    "Original backup",
  );
  copyFileSync(targetPath, backupPath, constants.COPYFILE_EXCL);
  try {
    await requireHash(backupPath, SUPPORTED.assetsSha256, "New original backup");
    assertOriginalInternals(parseArchive(backupPath));
  } catch (error) {
    if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }
    throw error;
  }
}

async function buildStage({ backupPath, targetPath, config }) {
  const archive = parseArchive(backupPath);
  const { runtime, data } = assertOriginalInternals(archive);
  ensureFreeSpace(
    dirname(targetPath),
    archive.fileSize + MIN_FREE_SPACE_MARGIN_BYTES,
    "Patched archive stage",
  );
  ensureFreeSpace(
    tmpdir(),
    runtime.length + data.length + MIN_FREE_SPACE_MARGIN_BYTES,
    "Temporary patch payloads",
  );
  const patchedRuntime = patchRuntime(runtime, String(config.speed), config.turbo, config.focus);
  const patchedData = patchData(
    data,
    config.goldMultiplier,
    config.disableMovementZoom,
  );
  const payloadDirectory = makePayloadDirectory();
  const runtimePath = join(payloadDirectory, "c3runtime.js");
  const dataPath = join(payloadDirectory, "data.json");
  const stagePath = join(dirname(targetPath), `.fast-cesto-stage-${randomUUID()}.dat`);

  try {
    writeFileSync(runtimePath, patchedRuntime, { flag: "wx" });
    writeFileSync(dataPath, patchedData.buffer, { flag: "wx" });
    repackArchive(archive, stagePath, [
      ["scripts/c3runtime.js", runtimePath],
      ["data.json", dataPath],
    ]);
    const outputArchive = parseArchive(stagePath);
    if (outputArchive.entries.length !== archive.entries.length) {
      throw new Error("Patched archive entry count changed unexpectedly");
    }
    const installedRuntimeSha256 = sha256Buffer(readEntry(outputArchive, "scripts/c3runtime.js"));
    const installedDataSha256 = sha256Buffer(readEntry(outputArchive, "data.json"));
    if (installedRuntimeSha256 !== sha256Buffer(patchedRuntime)) {
      throw new Error("Patched runtime verification failed");
    }
    if (installedDataSha256 !== sha256Buffer(patchedData.buffer)) {
      throw new Error("Patched data verification failed");
    }
    return {
      stagePath,
      installedAssetsSha256: await sha256File(stagePath),
      installedRuntimeSha256,
      installedDataSha256,
      entryCount: outputArchive.entries.length,
      removedMovementZoomActionSid: patchedData.removedActionSid,
      goldTargetActionCount: patchedData.goldPatch.targetActionSids.length,
      goldCloneActionCount: patchedData.goldPatch.cloneActionSids.length,
    };
  } catch (error) {
    if (existsSync(stagePath)) {
      unlinkSync(stagePath);
    }
    throw error;
  } finally {
    removePayloadDirectory(payloadDirectory);
  }
}

function stageStateFile(statePath, state) {
  mkdirSync(dirname(statePath), { recursive: true });
  const path = join(dirname(statePath), `.fast-cesto-state-${randomUUID()}.json`);
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx" });
  return path;
}

function writeTransactionFile(transactionPath, transaction) {
  mkdirSync(dirname(transactionPath), { recursive: true });
  const temporaryPath = join(
    dirname(transactionPath),
    `.fast-cesto-transaction-${randomUUID()}.json`,
  );
  writeFileSync(temporaryPath, `${JSON.stringify(transaction, null, 2)}\n`, { flag: "wx" });
  try {
    renameSync(temporaryPath, transactionPath);
  } catch (error) {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
    }
    throw error;
  }
}

function safeTransactionPath(directory, name, prefix, suffix) {
  const transactionId = typeof name === "string"
    ? name.slice(prefix.length, name.length - suffix.length)
    : "";
  if (
    typeof name !== "string"
    || basename(name) !== name
    || !name.startsWith(prefix)
    || !name.endsWith(suffix)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transactionId)
  ) {
    throw new Error(`Unsafe transaction filename: ${String(name)}`);
  }
  return join(directory, name);
}

async function optionalHash(path) {
  return existsSync(path) ? await sha256File(path) : null;
}

function readInstalledHashFromState(path) {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"))?.installedAssetsSha256 ?? null;
  } catch {
    return null;
  }
}

function unlinkIfExists(path) {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

async function restoreArchiveVersion({
  targetPath,
  swapPath,
  stagePath,
  oldAssetsSha256,
  newAssetsSha256,
}) {
  const targetHash = await optionalHash(targetPath);
  if (targetHash === oldAssetsSha256) {
    unlinkIfExists(stagePath);
    return;
  }
  const swapHash = await optionalHash(swapPath);
  if (swapHash !== oldAssetsSha256) {
    throw new Error("Interrupted transaction cannot find the verified previous archive");
  }
  if (targetHash !== null && targetHash !== newAssetsSha256) {
    throw new Error(`Interrupted transaction found an unknown current archive: ${targetHash}`);
  }
  if (existsSync(targetPath)) {
    unlinkSync(targetPath);
  }
  renameSync(swapPath, targetPath);
  await requireHash(targetPath, oldAssetsSha256, "Recovered previous archive");
  unlinkIfExists(stagePath);
}

async function restorePreviousState({
  statePath,
  stateSwapPath,
  stateStagePath,
  oldStateSha256,
  newStateSha256,
}) {
  const currentHash = await optionalHash(statePath);
  if (oldStateSha256 === null) {
    if (currentHash !== null && currentHash !== newStateSha256) {
      throw new Error("Interrupted transaction found an unknown install state file");
    }
    unlinkIfExists(statePath);
  } else if (currentHash !== oldStateSha256) {
    const swapHash = await optionalHash(stateSwapPath);
    if (swapHash !== oldStateSha256) {
      throw new Error("Interrupted transaction cannot find the verified previous install state");
    }
    if (currentHash !== null && currentHash !== newStateSha256) {
      throw new Error("Interrupted transaction found an unknown install state file");
    }
    unlinkIfExists(statePath);
    renameSync(stateSwapPath, statePath);
    await requireHash(statePath, oldStateSha256, "Recovered previous install state");
  }
  unlinkIfExists(stateStagePath);
}

async function commitInterruptedInstall({
  targetPath,
  statePath,
  archiveStagePath,
  archiveSwapPath,
  stateStagePath,
  stateSwapPath,
  transaction,
}) {
  await requireHash(targetPath, transaction.newAssetsSha256, "Interrupted installed archive");
  let stateHash = await optionalHash(statePath);
  if (stateHash !== transaction.newStateSha256) {
    await requireHash(
      stateStagePath,
      transaction.newStateSha256,
      "Interrupted staged install state",
    );
    if (existsSync(statePath)) {
      if (stateHash !== transaction.oldStateSha256) {
        throw new Error("Interrupted transaction found an unexpected install state");
      }
      if (!existsSync(stateSwapPath)) {
        renameSync(statePath, stateSwapPath);
      } else {
        await requireHash(
          stateSwapPath,
          transaction.oldStateSha256,
          "Interrupted previous install state",
        );
        unlinkSync(statePath);
      }
    }
    renameSync(stateStagePath, statePath);
    stateHash = await requireHash(
      statePath,
      transaction.newStateSha256,
      "Recovered installed state",
    );
  }
  if (
    stateHash !== transaction.newStateSha256
    || readInstalledHashFromState(statePath) !== transaction.newAssetsSha256
  ) {
    throw new Error("Recovered install state does not describe the installed archive");
  }
  unlinkIfExists(archiveStagePath);
  unlinkIfExists(archiveSwapPath);
  unlinkIfExists(stateStagePath);
  unlinkIfExists(stateSwapPath);
}

export async function recoverInterruptedTransaction({
  targetPath,
  statePath,
  transactionPath,
  preferRollback = false,
}) {
  if (!existsSync(transactionPath)) {
    return { result: "none" };
  }
  const transaction = readJson(transactionPath, "Transaction journal");
  if (
    transaction?.schemaVersion !== TRANSACTION_SCHEMA_VERSION
    || !["install", "restore"].includes(transaction.operation)
    || typeof transaction.oldAssetsSha256 !== "string"
    || typeof transaction.newAssetsSha256 !== "string"
  ) {
    throw new Error(`Transaction journal is incompatible or incomplete: ${transactionPath}`);
  }
  const targetDirectory = dirname(targetPath);
  const stateDirectory = dirname(statePath);
  const archiveStagePath = safeTransactionPath(
    targetDirectory,
    transaction.archiveStageName,
    ".fast-cesto-stage-",
    ".dat",
  );
  const archiveSwapPath = safeTransactionPath(
    targetDirectory,
    transaction.archiveSwapName,
    ".fast-cesto-swap-",
    ".dat",
  );

  if (transaction.operation === "restore") {
    const targetHash = await optionalHash(targetPath);
    if (!preferRollback && targetHash === transaction.newAssetsSha256) {
      unlinkIfExists(archiveStagePath);
      unlinkIfExists(archiveSwapPath);
      unlinkSync(transactionPath);
      return { result: "recovered", operation: "restore", outcome: "committed" };
    }
    await restoreArchiveVersion({
      targetPath,
      swapPath: archiveSwapPath,
      stagePath: archiveStagePath,
      oldAssetsSha256: transaction.oldAssetsSha256,
      newAssetsSha256: transaction.newAssetsSha256,
    });
    unlinkIfExists(archiveSwapPath);
    unlinkSync(transactionPath);
    return { result: "recovered", operation: "restore", outcome: "rolled-back" };
  }

  if (
    typeof transaction.newStateSha256 !== "string"
    || !(transaction.oldStateSha256 === null || typeof transaction.oldStateSha256 === "string")
  ) {
    throw new Error("Install transaction journal does not contain state hashes");
  }
  const stateStagePath = safeTransactionPath(
    stateDirectory,
    transaction.stateStageName,
    ".fast-cesto-state-",
    ".json",
  );
  if (basename(stateStagePath).startsWith(".fast-cesto-state-swap-")) {
    throw new Error("Unsafe staged state filename in transaction journal");
  }
  const stateSwapPath = safeTransactionPath(
    stateDirectory,
    transaction.stateSwapName,
    ".fast-cesto-state-swap-",
    ".json",
  );
  const targetHash = await optionalHash(targetPath);
  const stateCanCommit = (
    await optionalHash(statePath) === transaction.newStateSha256
    || await optionalHash(stateStagePath) === transaction.newStateSha256
  );
  if (!preferRollback && targetHash === transaction.newAssetsSha256 && stateCanCommit) {
    await commitInterruptedInstall({
      targetPath,
      statePath,
      archiveStagePath,
      archiveSwapPath,
      stateStagePath,
      stateSwapPath,
      transaction,
    });
    unlinkSync(transactionPath);
    return { result: "recovered", operation: "install", outcome: "committed" };
  }

  await restoreArchiveVersion({
    targetPath,
    swapPath: archiveSwapPath,
    stagePath: archiveStagePath,
    oldAssetsSha256: transaction.oldAssetsSha256,
    newAssetsSha256: transaction.newAssetsSha256,
  });
  await restorePreviousState({
    statePath,
    stateSwapPath,
    stateStagePath,
    oldStateSha256: transaction.oldStateSha256,
    newStateSha256: transaction.newStateSha256,
  });
  unlinkIfExists(archiveSwapPath);
  unlinkIfExists(stateSwapPath);
  unlinkSync(transactionPath);
  return { result: "recovered", operation: "install", outcome: "rolled-back" };
}

function cleanupOrphanStages(targetDirectory, stateDirectory) {
  const removed = [];
  for (const name of readdirSync(targetDirectory)) {
    if (/^\.fast-cesto-stage-[0-9a-f-]+\.dat$/i.test(name)) {
      unlinkSync(join(targetDirectory, name));
      removed.push(name);
    }
    if (/^\.fast-cesto-swap-[0-9a-f-]+\.dat$/i.test(name)) {
      throw new Error(`Unjournaled archive swap requires manual inspection: ${name}`);
    }
  }
  for (const name of readdirSync(stateDirectory)) {
    if (/^\.fast-cesto-state-[0-9a-f-]+\.json$/i.test(name)) {
      unlinkSync(join(stateDirectory, name));
      removed.push(name);
    }
    if (/^\.fast-cesto-(?:state-swap|transaction)-[0-9a-f-]+\.json$/i.test(name)) {
      if (name.startsWith(".fast-cesto-transaction-")) {
        unlinkSync(join(stateDirectory, name));
        removed.push(name);
      } else {
        throw new Error(`Unjournaled state swap requires manual inspection: ${name}`);
      }
    }
  }
  return removed;
}

async function installTransaction({
  targetPath,
  stagePath,
  expectedHash,
  oldAssetsSha256,
  statePath,
  transactionPath,
  state,
}) {
  const archiveSwapPath = join(dirname(targetPath), `.fast-cesto-swap-${randomUUID()}.dat`);
  const stateStagePath = stageStateFile(statePath, state);
  const stateSwapPath = join(dirname(statePath), `.fast-cesto-state-swap-${randomUUID()}.json`);
  const oldStateSha256 = await optionalHash(statePath);
  const newStateSha256 = await sha256File(stateStagePath);
  writeTransactionFile(transactionPath, {
    schemaVersion: TRANSACTION_SCHEMA_VERSION,
    operation: "install",
    createdAt: new Date().toISOString(),
    oldAssetsSha256,
    newAssetsSha256: expectedHash,
    oldStateSha256,
    newStateSha256,
    archiveStageName: basename(stagePath),
    archiveSwapName: basename(archiveSwapPath),
    stateStageName: basename(stateStagePath),
    stateSwapName: basename(stateSwapPath),
  });
  let oldArchiveMoved = false;
  let newArchiveInstalled = false;
  let oldStateMoved = false;
  let newStateInstalled = false;

  try {
    renameSync(targetPath, archiveSwapPath);
    oldArchiveMoved = true;
    renameSync(stagePath, targetPath);
    newArchiveInstalled = true;
    await requireHash(targetPath, expectedHash, "Installed archive");

    if (existsSync(statePath)) {
      renameSync(statePath, stateSwapPath);
      oldStateMoved = true;
    }
    renameSync(stateStagePath, statePath);
    newStateInstalled = true;
  } catch (error) {
    if (newStateInstalled && existsSync(statePath)) {
      unlinkSync(statePath);
    }
    if (oldStateMoved && existsSync(stateSwapPath)) {
      renameSync(stateSwapPath, statePath);
    }
    if (newArchiveInstalled && existsSync(targetPath)) {
      renameSync(targetPath, stagePath);
    }
    if (oldArchiveMoved && existsSync(archiveSwapPath) && !existsSync(targetPath)) {
      renameSync(archiveSwapPath, targetPath);
    }
    if (existsSync(stagePath)) {
      unlinkSync(stagePath);
    }
    if (existsSync(stateStagePath)) {
      unlinkSync(stateStagePath);
    }
    unlinkIfExists(transactionPath);
    throw error;
  }

  unlinkSync(archiveSwapPath);
  if (oldStateMoved) {
    unlinkSync(stateSwapPath);
  }
  unlinkSync(transactionPath);
}

async function restoreTransaction(targetPath, backupPath, transactionPath, oldAssetsSha256) {
  const stagePath = join(dirname(targetPath), `.fast-cesto-stage-${randomUUID()}.dat`);
  const swapPath = join(dirname(targetPath), `.fast-cesto-swap-${randomUUID()}.dat`);
  ensureFreeSpace(
    dirname(targetPath),
    statSync(backupPath).size + MIN_FREE_SPACE_MARGIN_BYTES,
    "Original restore stage",
  );
  copyFileSync(backupPath, stagePath, constants.COPYFILE_EXCL);
  await requireHash(stagePath, SUPPORTED.assetsSha256, "Staged original archive");
  writeTransactionFile(transactionPath, {
    schemaVersion: TRANSACTION_SCHEMA_VERSION,
    operation: "restore",
    createdAt: new Date().toISOString(),
    oldAssetsSha256,
    newAssetsSha256: SUPPORTED.assetsSha256,
    archiveStageName: basename(stagePath),
    archiveSwapName: basename(swapPath),
  });
  let oldMoved = false;
  let originalInstalled = false;
  try {
    renameSync(targetPath, swapPath);
    oldMoved = true;
    renameSync(stagePath, targetPath);
    originalInstalled = true;
    await requireHash(targetPath, SUPPORTED.assetsSha256, "Restored original archive");
  } catch (error) {
    if (originalInstalled && existsSync(targetPath)) {
      renameSync(targetPath, stagePath);
    }
    if (oldMoved && existsSync(swapPath) && !existsSync(targetPath)) {
      renameSync(swapPath, targetPath);
    }
    if (existsSync(stagePath)) {
      unlinkSync(stagePath);
    }
    unlinkIfExists(transactionPath);
    throw error;
  }
  unlinkSync(swapPath);
  unlinkSync(transactionPath);
}

async function status(targetPath, backupPath, statePath) {
  const currentSha256 = await sha256File(targetPath);
  let state = null;
  let stateError = null;
  try {
    state = readState(statePath);
  } catch (error) {
    stateError = error instanceof Error ? error.message : String(error);
  }
  const backupSha256 = existsSync(backupPath) ? await sha256File(backupPath) : null;
  return {
    state: classifyInstallState(currentSha256, state),
    currentSha256,
    gameVersion: SUPPORTED.gameVersion,
    backupValid: backupSha256 === SUPPORTED.assetsSha256,
    backupSha256,
    stateManifestValid: stateError === null && state !== null,
    stateError,
    activeConfig: state?.installedAssetsSha256 === currentSha256 ? state.config : null,
    lastInstalledConfig: state?.config ?? null,
  };
}

async function main() {
  const [, , command, gameDirectoryArg, firstOptionalArg, secondOptionalArg] = process.argv;
  if (!command || !gameDirectoryArg || !["status", "install", "restore"].includes(command)) {
    usage();
    process.exit(2);
  }
  const gameDirectory = resolve(gameDirectoryArg);
  const targetPath = join(gameDirectory, "www", "assets.dat");
  const configPath = command === "install"
    ? resolve(firstOptionalArg ?? DEFAULT_CONFIG_PATH)
    : null;
  const stateDirectory = resolve(
    command === "install"
      ? secondOptionalArg ?? DEFAULT_STATE_DIRECTORY
      : firstOptionalArg ?? DEFAULT_STATE_DIRECTORY,
  );
  const backupPath = join(stateDirectory, "assets.dat");
  const statePath = join(stateDirectory, "install-state.json");
  const transactionPath = join(stateDirectory, "transaction.json");
  const lock = acquireOperationLock(stateDirectory);
  const operationId = randomUUID();
  const startedAt = Date.now();
  const complete = (payload) => {
    recordOperation(stateDirectory, {
      operationId,
      command,
      outcome: "success",
      result: payload.result ?? payload.state,
      durationMs: Date.now() - startedAt,
      gameVersion: payload.gameVersion ?? SUPPORTED.gameVersion,
      currentSha256: payload.currentSha256,
      configuration: payload.config ?? payload.activeConfig,
      recovery: payload.recovery,
    });
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  };

  try {
    const gameRunning = isGameRunning();
    let recovery = { result: "none" };
    if (existsSync(transactionPath)) {
      if (gameRunning) {
        throw new Error("Close Sol Cesto so Fast Cesto can recover an interrupted transaction");
      }
      recovery = await recoverInterruptedTransaction({
        targetPath,
        statePath,
        transactionPath,
      });
    }
    const removedOrphanStages = cleanupOrphanStages(
      dirname(targetPath),
      stateDirectory,
    );

    if (command === "status") {
      return complete({
        ...await status(targetPath, backupPath, statePath),
        gameRunning,
        recovery,
        removedOrphanStages,
      });
    }
    if (gameRunning) {
      throw new Error("Close Sol Cesto before installing or restoring Fast Cesto");
    }

    const currentSha256 = await sha256File(targetPath);
    const state = readState(statePath);
    const currentState = classifyInstallState(currentSha256, state);
    if (currentState === "unknown") {
      throw new Error(`Refusing to modify unknown assets.dat: ${currentSha256}`);
    }
    await ensureOriginalBackup(targetPath, backupPath, currentState);

    if (command === "restore") {
      if (currentState === "original") {
        return complete({
          result: "already-restored",
          currentSha256,
          recovery,
          removedOrphanStages,
        });
      }
      await restoreTransaction(
        targetPath,
        backupPath,
        transactionPath,
        currentSha256,
      );
      return complete({
        result: "restored",
        currentSha256: SUPPORTED.assetsSha256,
        backupValid: true,
        recovery,
        removedOrphanStages,
      });
    }

    const config = validateConfig(readJson(configPath, "Config"));
    if (
      currentState === "installed"
      && state.patchImplementationVersion === PATCH_IMPLEMENTATION_VERSION
      && JSON.stringify(state.config) === JSON.stringify(config)
    ) {
      return complete({
        result: "already-installed",
        currentSha256,
        config,
        recovery,
        removedOrphanStages,
      });
    }

    const build = await buildStage({ backupPath, targetPath, config });
    const newState = {
      schemaVersion: STATE_SCHEMA_VERSION,
      product: "Fast Cesto internal alpha",
      patchImplementationVersion: PATCH_IMPLEMENTATION_VERSION,
      gameVersion: SUPPORTED.gameVersion,
      originalAssetsSha256: SUPPORTED.assetsSha256,
      installedAssetsSha256: build.installedAssetsSha256,
      installedRuntimeSha256: build.installedRuntimeSha256,
      installedDataSha256: build.installedDataSha256,
      entryCount: build.entryCount,
      config,
      patchSummary: {
        removedMovementZoomActionSid: build.removedMovementZoomActionSid,
        goldTargetActionCount: build.goldTargetActionCount,
        goldCloneActionCount: build.goldCloneActionCount,
      },
      installedAt: new Date().toISOString(),
    };
    await installTransaction({
      targetPath,
      stagePath: build.stagePath,
      expectedHash: build.installedAssetsSha256,
      oldAssetsSha256: currentSha256,
      statePath,
      transactionPath,
      state: newState,
    });
    return complete({
      result: currentState === "installed" ? "reconfigured" : "installed",
      currentSha256: build.installedAssetsSha256,
      config,
      backupValid: true,
      patchSummary: newState.patchSummary,
      recovery,
      removedOrphanStages,
    });
  } catch (error) {
    recordOperation(stateDirectory, {
      operationId,
      command,
      outcome: "error",
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  } finally {
    releaseOperationLock(lock);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(formatErrorForUser(error));
    process.exit(1);
  });
}
