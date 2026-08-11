import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArchive, readEntry } from "./c3-asset-archive.mjs";

const [, , originalAssetsArg, prototypeDirectoryArg] = process.argv;

if (!originalAssetsArg || !prototypeDirectoryArg) {
  console.error(
    "Usage: node verify-prototype.mjs <original-assets.dat> <prototype-directory>",
  );
  process.exit(2);
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

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function collectActions(events, actionLocations = []) {
  for (const event of events) {
    const actions = Array.isArray(event?.[7]) ? event[7] : [];
    actions.forEach((action, index) => actionLocations.push({ actions, action, index }));
    collectActions(Array.isArray(event?.[8]) ? event[8] : [], actionLocations);
  }
  return actionLocations;
}

function actionWithoutSid(action) {
  const clone = structuredClone(action);
  clone[3] = null;
  return JSON.stringify(clone);
}

const originalAssetsPath = resolve(originalAssetsArg);
const prototypeDirectory = resolve(prototypeDirectoryArg);
const prototypeAssetsPath = join(prototypeDirectory, "assets.dat");
const manifest = JSON.parse(
  readFileSync(join(prototypeDirectory, "prototype.json"), "utf8"),
);

requireEqual(
  await sha256File(originalAssetsPath),
  manifest.compatibility.originalAssetsSha256,
  "Original archive hash",
);
requireEqual(
  await sha256File(prototypeAssetsPath),
  manifest.output.assetsSha256,
  "Prototype archive hash",
);

const originalArchive = parseArchive(originalAssetsPath);
const prototypeArchive = parseArchive(prototypeAssetsPath);
requireEqual(
  prototypeArchive.entries.length,
  originalArchive.entries.length,
  "Archive entry count",
);

const originalByName = new Map(originalArchive.entries.map((entry) => [entry.name, entry]));
const changedEntries = [];
for (const prototypeEntry of prototypeArchive.entries) {
  const originalEntry = originalByName.get(prototypeEntry.name);
  if (!originalEntry) {
    throw new Error(`Prototype added an unexpected archive entry: ${prototypeEntry.name}`);
  }
  const originalHash = sha256Buffer(readEntry(originalArchive, originalEntry.name));
  const prototypeHash = sha256Buffer(readEntry(prototypeArchive, prototypeEntry.name));
  if (originalHash !== prototypeHash) {
    changedEntries.push(prototypeEntry.name);
  }
}
requireEqual(
  JSON.stringify(changedEntries.sort()),
  JSON.stringify(["data.json", "scripts/c3runtime.js"]),
  "Changed archive entries",
);

const runtime = readEntry(prototypeArchive, "scripts/c3runtime.js").toString("utf8");
if (!runtime.includes(`_fastCestoMultiplier=${manifest.settings.speed}`)) {
  throw new Error("Runtime speed multiplier marker is missing");
}
if (!runtime.includes("this._timeScale=e*this._fastCestoMultiplier")) {
  throw new Error("Runtime SetTimeScale wrapper is missing");
}

const data = JSON.parse(readEntry(prototypeArchive, "data.json").toString("utf8"));
const allActions = collectActions(
  data.project?.[6]?.flatMap((sheet) => sheet?.[1] ?? []) ?? [],
);
const actionsBySid = new Map();
for (const location of allActions) {
  const sid = location.action?.[3];
  if (!Number.isSafeInteger(sid)) {
    continue;
  }
  const existing = actionsBySid.get(sid) ?? [];
  existing.push(location);
  actionsBySid.set(sid, existing);
}

requireEqual(
  actionsBySid.get(manifest.output.removedMovementZoomActionSid)?.length ?? 0,
  0,
  "Removed movement zoom action count",
);

const goldPatch = manifest.output.goldRewardPatch;
const multiplier = manifest.settings.goldMultiplier;
const targetSids = new Set(goldPatch.targetActionSids);
const cloneSids = new Set(goldPatch.cloneActionSids);
requireEqual(targetSids.size, goldPatch.targetActionCount, "Unique gold target action count");
requireEqual(
  cloneSids.size,
  goldPatch.duplicatedActionCount,
  "Unique cloned gold action count",
);
requireEqual(
  cloneSids.size,
  targetSids.size * (multiplier - 1),
  "Gold clone count for multiplier",
);

for (const targetSid of targetSids) {
  const locations = actionsBySid.get(targetSid) ?? [];
  requireEqual(locations.length, 1, `Gold target action ${targetSid} count`);
  const [{ actions, action, index }] = locations;
  for (let copyIndex = 1; copyIndex < multiplier; copyIndex += 1) {
    const clone = actions[index + copyIndex];
    if (!cloneSids.has(clone?.[3])) {
      throw new Error(`Gold target ${targetSid} is not followed by a registered clone`);
    }
    requireEqual(
      actionWithoutSid(clone),
      actionWithoutSid(action),
      `Gold clone for target ${targetSid}`,
    );
  }
}
for (const cloneSid of cloneSids) {
  requireEqual(
    actionsBySid.get(cloneSid)?.length ?? 0,
    1,
    `Cloned gold action ${cloneSid} count`,
  );
}

const excludedGoldActions = {
  officialOffer: 108687569770924,
  storyGrant: 573312497566021,
  progressionSpendBalance: 796949351986045,
  progressionSpendDisplay: 649035037095775,
};
for (const [label, sid] of Object.entries(excludedGoldActions)) {
  requireEqual(actionsBySid.get(sid)?.length ?? 0, 1, `Excluded ${label} action count`);
}

console.log(JSON.stringify({
  result: "verified",
  gameVersion: manifest.gameVersion,
  settings: manifest.settings,
  changedEntries,
  goldTargetActionCount: targetSids.size,
  goldCloneActionCount: cloneSids.size,
  excludedGoldActions,
  prototypeAssetsSha256: manifest.output.assetsSha256,
}, null, 2));
