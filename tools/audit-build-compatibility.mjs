import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArchive, readEntry } from "./c3-asset-archive.mjs";
import { patchData, patchRuntime } from "./build-prototype.mjs";

const [, , assetsArg] = process.argv;
if (!assetsArg) {
  console.error("Usage: node audit-build-compatibility.mjs <assets.dat>");
  process.exit(2);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

const assetsPath = resolve(assetsArg);
const archive = parseArchive(assetsPath);
const runtime = readEntry(archive, "scripts/c3runtime.js");
const data = readEntry(archive, "data.json");
const project = JSON.parse(data.toString("utf8")).project;

const runtimeResults = [];
for (const speed of ["1", "1.25", "1.5", "2"]) {
  for (const temporaryMode of ["off", "turbo", "focus", "both"]) {
    const turbo = {
      enabled: temporaryMode === "turbo" || temporaryMode === "both",
      key: "ShiftLeft",
      multiplier: 2,
    };
    const focus = {
      enabled: temporaryMode === "focus" || temporaryMode === "both",
      key: "ControlLeft",
      targetSpeed: 0.5,
    };
    const patched = patchRuntime(runtime, speed, turbo, focus);
    assert.notDeepEqual(patched, runtime, `${speed} ${temporaryMode} runtime patch`);
    runtimeResults.push({ speed: Number(speed), temporaryMode, sha256: sha256(patched) });
  }
}

const dataResults = [];
for (const goldMultiplier of [1, 2, 3]) {
  for (const disableMovementZoom of [false, true]) {
    const patched = patchData(data, goldMultiplier, disableMovementZoom);
    assert.equal(
      patched.goldPatch.targetActionSids.length,
      20,
      `${goldMultiplier}x gold target count`,
    );
    assert.equal(
      patched.goldPatch.cloneActionSids.length,
      20 * (goldMultiplier - 1),
      `${goldMultiplier}x gold clone count`,
    );
    assert.equal(
      patched.removedActionSid,
      disableMovementZoom ? 938984979377417 : null,
      "movement Zoom action",
    );
    dataResults.push({
      goldMultiplier,
      disableMovementZoom,
      sha256: sha256(patched.buffer),
    });
  }
}

console.log(JSON.stringify({
  result: "compatible",
  source: {
    path: assetsPath,
    archiveSha256: sha256(readFileSync(assetsPath)),
    entryCount: archive.entries.length,
    projectVersion: project?.[16] ?? null,
    runtimeSha256: sha256(runtime),
    dataSha256: sha256(data),
  },
  runtimeConfigurationsChecked: runtimeResults.length,
  dataConfigurationsChecked: dataResults.length,
  runtimeResults,
  dataResults,
}, null, 2));
