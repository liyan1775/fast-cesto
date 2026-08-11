import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { parseArchive, readEntry } from "./c3-asset-archive.mjs";
import { patchData, patchRuntime } from "./build-prototype.mjs";

const [, , originalAssetsArg = "backups/epic-1.01.3/assets.dat"] = process.argv;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const archive = parseArchive(resolve(originalAssetsArg));
const runtime = readEntry(archive, "scripts/c3runtime.js");
const data = readEntry(archive, "data.json");

const runtime15 = patchRuntime(runtime, "1.5");
const runtime15Text = runtime15.toString("utf8");
for (const marker of [
  '"timescale":this._fastCestoBaseTimeScale',
  'this._fastCestoBaseTimeScale=i["timescale"],this._timeScale=this._fastCestoBaseTimeScale*this._fastCestoMultiplier',
]) {
  if (!runtime15Text.includes(marker)) {
    throw new Error(`Speed save/load runtime marker missing: ${marker}`);
  }
}
for (const removedMarker of [
  '"timescale":this.GetTimeScale()',
  'this._timeScale=i["timescale"]',
]) {
  if (runtime15Text.includes(removedMarker)) {
    throw new Error(`Original save/load runtime marker remains: ${removedMarker}`);
  }
}

const runtimeTurbo = patchRuntime(runtime, "1.5", {
  enabled: true,
  key: "ShiftLeft",
  multiplier: 2,
}).toString("utf8");
for (const marker of [
  "_fastCestoTurboMultiplier=2",
  "_fastCestoSetTurbo",
  'e.data["code"]==="ShiftLeft"',
  'new C3.ScreenReaderText(this,"Fast Cesto Turbo off")',
  'SetText(e?"Fast Cesto Turbo on":"Fast Cesto Turbo off")',
  'this._fastCestoBaseTimeScale=i["timescale"],this._fastCestoTurboActive=!1',
  'addEventListener("window-blur",()=>this._fastCestoSetTurbo(!1))',
  'addEventListener("keyboard-blur",()=>this._fastCestoSetTurbo(!1))',
  'addEventListener("suspend",()=>this._fastCestoSetTurbo(!1))',
]) {
  if (!runtimeTurbo.includes(marker)) {
    throw new Error(`Turbo runtime marker missing: ${marker}`);
  }
}

const expectedDataHashes = new Map([
  [1, "042430A7EC5B64B915071D62B6EC240F0E92EF9E5E564B334832BA76AC7033D6"],
  [2, "19CDE9242F7C2E388A04BB53FCCCB1B4D2D93416B0967E50D754A4B592148E00"],
]);
const results = [];

for (const multiplier of [1, 2, 3]) {
  const patched = patchData(data, multiplier);
  requireEqual(
    patched.goldPatch.targetActionSids.length,
    20,
    `${multiplier}x gold target count`,
  );
  requireEqual(
    patched.goldPatch.cloneActionSids.length,
    20 * (multiplier - 1),
    `${multiplier}x gold clone count`,
  );
  const dataSha256 = sha256(patched.buffer);
  if (expectedDataHashes.has(multiplier)) {
    requireEqual(
      dataSha256,
      expectedDataHashes.get(multiplier),
      `${multiplier}x data hash`,
    );
  }
  results.push({
    multiplier,
    targetActionCount: patched.goldPatch.targetActionSids.length,
    cloneActionCount: patched.goldPatch.cloneActionSids.length,
    dataSha256,
  });
}

const originalZoom = patchData(data, 1, false);
requireEqual(
  originalZoom.removedActionSid,
  null,
  "original movement zoom retained",
);
requireEqual(
  originalZoom.goldPatch.cloneActionSids.length,
  0,
  "original zoom configuration gold clone count",
);

console.log(JSON.stringify({
  result: "passed",
  runtime15Sha256: sha256(runtime15),
  originalZoomDataSha256: sha256(originalZoom.buffer),
  results,
}, null, 2));
