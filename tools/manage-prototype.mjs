import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const ORIGINAL_ASSETS_SHA256 =
  "EAFD1E359A0804D28F174D6ECADB587BF44CC849A74839F06ABDBF4CAB88B5DD";

function usage() {
  console.error(
    "Usage: node manage-prototype.mjs <status|install|restore> <SolCesto-directory> <prototype-directory> [backup-directory]",
  );
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

async function makeVerifiedStage(sourcePath, targetPath, expectedHash) {
  const stagePath = join(
    dirname(targetPath),
    `.fast-cesto-stage-${randomUUID()}.dat`,
  );
  copyFileSync(sourcePath, stagePath, constants.COPYFILE_EXCL);
  try {
    await requireHash(stagePath, expectedHash, "Staged archive");
    return stagePath;
  } catch (error) {
    if (existsSync(stagePath)) {
      unlinkSync(stagePath);
    }
    throw error;
  }
}

async function replaceUsingBackup({
  targetPath,
  stagePath,
  backupPath,
  expectedNewHash,
  preserveCurrentAsBackup,
}) {
  const swapPath = join(
    dirname(targetPath),
    `.fast-cesto-swap-${randomUUID()}.dat`,
  );
  const oldPath = preserveCurrentAsBackup ? backupPath : swapPath;
  let movedOld = false;
  let installedNew = false;

  try {
    renameSync(targetPath, oldPath);
    movedOld = true;
    renameSync(stagePath, targetPath);
    installedNew = true;
    await requireHash(targetPath, expectedNewHash, "Installed archive");
  } catch (error) {
    if (installedNew && existsSync(targetPath)) {
      renameSync(targetPath, stagePath);
    }
    if (movedOld && existsSync(oldPath) && !existsSync(targetPath)) {
      renameSync(oldPath, targetPath);
    }
    if (existsSync(stagePath)) {
      unlinkSync(stagePath);
    }
    throw error;
  }

  if (!preserveCurrentAsBackup && existsSync(swapPath)) {
    unlinkSync(swapPath);
  }
}

async function main() {
  const [, , command, gameDirectoryArg, prototypeDirectoryArg, backupDirectoryArg] =
    process.argv;
  if (!command || !gameDirectoryArg || !prototypeDirectoryArg) {
    usage();
    process.exit(2);
  }
  if (!["status", "install", "restore"].includes(command)) {
    usage();
    process.exit(2);
  }

  const gameDirectory = resolve(gameDirectoryArg);
  const prototypeDirectory = resolve(prototypeDirectoryArg);
  const backupDirectory = resolve(
    backupDirectoryArg ?? join("backups", "epic-1.01.3"),
  );
  const targetPath = join(gameDirectory, "www", "assets.dat");
  const prototypePath = join(prototypeDirectory, "assets.dat");
  const manifestPath = join(prototypeDirectory, "prototype.json");
  const backupPath = join(backupDirectory, "assets.dat");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const prototypeSha256 = manifest?.output?.assetsSha256;

  if (manifest?.compatibility?.originalAssetsSha256 !== ORIGINAL_ASSETS_SHA256) {
    throw new Error("Prototype manifest targets a different original game build");
  }
  if (typeof prototypeSha256 !== "string") {
    throw new Error("Prototype manifest does not contain an output archive hash");
  }
  await requireHash(prototypePath, prototypeSha256, "Prototype archive");

  const currentSha256 = await sha256File(targetPath);
  const state = currentSha256 === ORIGINAL_ASSETS_SHA256
    ? "original"
    : currentSha256 === prototypeSha256
      ? "prototype"
      : "unknown";

  if (command === "status") {
    const backupSha256 = existsSync(backupPath) ? await sha256File(backupPath) : null;
    console.log(JSON.stringify({
      state,
      currentSha256,
      prototypeSha256,
      backupPath,
      backupSha256,
      backupValid: backupSha256 === ORIGINAL_ASSETS_SHA256,
    }, null, 2));
    return;
  }

  if (state === "unknown") {
    throw new Error(`Refusing to modify unknown assets.dat: ${currentSha256}`);
  }

  if (command === "install") {
    if (state === "prototype") {
      console.log(JSON.stringify({ result: "already-installed", currentSha256 }, null, 2));
      return;
    }

    mkdirSync(backupDirectory, { recursive: true });
    const backupExists = existsSync(backupPath);
    if (backupExists) {
      await requireHash(backupPath, ORIGINAL_ASSETS_SHA256, "Existing backup");
    }
    const stagePath = await makeVerifiedStage(
      prototypePath,
      targetPath,
      prototypeSha256,
    );
    await replaceUsingBackup({
      targetPath,
      stagePath,
      backupPath,
      expectedNewHash: prototypeSha256,
      preserveCurrentAsBackup: !backupExists,
    });
    await requireHash(backupPath, ORIGINAL_ASSETS_SHA256, "Original backup");
    console.log(JSON.stringify({
      result: "installed",
      currentSha256: prototypeSha256,
      backupPath,
      backupSha256: ORIGINAL_ASSETS_SHA256,
    }, null, 2));
    return;
  }

  if (state === "original") {
    console.log(JSON.stringify({ result: "already-restored", currentSha256 }, null, 2));
    return;
  }
  if (!existsSync(backupPath)) {
    throw new Error(`Original backup not found: ${backupPath}`);
  }
  await requireHash(backupPath, ORIGINAL_ASSETS_SHA256, "Original backup");
  const stagePath = await makeVerifiedStage(
    backupPath,
    targetPath,
    ORIGINAL_ASSETS_SHA256,
  );
  await replaceUsingBackup({
    targetPath,
    stagePath,
    backupPath,
    expectedNewHash: ORIGINAL_ASSETS_SHA256,
    preserveCurrentAsBackup: false,
  });
  console.log(JSON.stringify({
    result: "restored",
    currentSha256: ORIGINAL_ASSETS_SHA256,
    backupPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
