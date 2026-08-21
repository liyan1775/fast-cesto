import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { parseArchive, readEntry } from "./c3-asset-archive.mjs";
import { patchData, patchRuntime } from "./build-prototype.mjs";

const [, , originalAssetsArg = "backups/epic-1.01.4b/assets.dat"] = process.argv;

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
  'this._fastCestoBaseTimeScale=i["timescale"],this._fastCestoResetTemporarySpeed()',
  'addEventListener("window-blur",()=>this._fastCestoResetTemporarySpeed())',
  'addEventListener("keyboard-blur",()=>this._fastCestoResetTemporarySpeed())',
  'addEventListener("suspend",()=>this._fastCestoResetTemporarySpeed())',
]) {
  if (!runtimeTurbo.includes(marker)) {
    throw new Error(`Turbo runtime marker missing: ${marker}`);
  }
}

const runtimeFocus = patchRuntime(
  runtime,
  "1.5",
  { enabled: true, key: "ShiftLeft", multiplier: 2 },
  { enabled: true, key: "ControlLeft", targetSpeed: 0.5 },
).toString("utf8");
for (const marker of [
  "_fastCestoFocusTarget=0.5",
  "_fastCestoSetFocus",
  'e.data["code"]==="ControlLeft"&&this._fastCestoSetFocus(!0)',
  'e.data["code"]==="ControlLeft"&&this._fastCestoSetFocus(!1)',
  'new C3.ScreenReaderText(this,"Fast Cesto Focus off")',
  'SetText(e?"Fast Cesto Focus on":"Fast Cesto Focus off")',
  "this._fastCestoFocusActive?this._fastCestoFocusTarget:this._fastCestoMultiplier*(this._fastCestoTurboActive?this._fastCestoTurboMultiplier:1)",
  "SetTimeScale(e){(isNaN(e)||e<0)&&(e=0),this._fastCestoBaseTimeScale=e,this._fastCestoUpdateTimeScale()}",
  'this._fastCestoTurboActive=!1,this._fastCestoFocusActive=!1,this._fastCestoUpdateTimeScale()',
]) {
  if (!runtimeFocus.includes(marker)) {
    throw new Error(`Focus runtime marker missing: ${marker}`);
  }
}

const runtimeState = {};
const runtimeInitializerStart = runtimeFocus.indexOf(
  "this._timeScale=1.5,this._fastCestoMultiplier=1.5",
);
const runtimeInitializerEnd = runtimeFocus.indexOf(
  ",this._maxDt=1/30",
  runtimeInitializerStart,
);
requireEqual(runtimeInitializerStart >= 0, true, "temporary runtime initializer start");
requireEqual(runtimeInitializerEnd > runtimeInitializerStart, true, "temporary runtime initializer end");
const runtimeInitializer = new Function(
  runtimeFocus.slice(runtimeInitializerStart, runtimeInitializerEnd),
);
runtimeInitializer.call(runtimeState);
requireEqual(runtimeState._timeScale, 1.5, "temporary runtime initial base speed");
runtimeState._fastCestoSetTurbo(true);
requireEqual(runtimeState._timeScale, 3, "Turbo active speed");
runtimeState._fastCestoSetFocus(true);
requireEqual(runtimeState._timeScale, 0.5, "Focus overrides Turbo");
runtimeState._fastCestoSetTurbo(false);
requireEqual(runtimeState._timeScale, 0.5, "Focus remains after Turbo release");
runtimeState._fastCestoSetTurbo(true);
runtimeState._fastCestoSetFocus(false);
requireEqual(runtimeState._timeScale, 3, "Turbo resumes after Focus release");
runtimeState._fastCestoResetTemporarySpeed();
requireEqual(runtimeState._timeScale, 1.5, "temporary speed reset to base");
runtimeState._fastCestoBaseTimeScale = 0;
runtimeState._fastCestoSetFocus(true);
requireEqual(runtimeState._timeScale, 0, "game pause remains zero under Focus");
runtimeState._fastCestoResetTemporarySpeed();
requireEqual(runtimeState._timeScale, 0, "game pause remains zero after reset");

const expectedDataHashes = new Map([
  [1, "71BE7C4B83B176FE7293A6BC1BAB6311BB9B08D5FB50E113657FDD739492D41C"],
  [2, "45DB552770D1CDD1A96BDD8F712A1FA3D62A7D99C7E06F24E1678D576806B762"],
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
