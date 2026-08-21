import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArchive, readEntry } from "./c3-asset-archive.mjs";
import { patchRuntime } from "./build-prototype.mjs";

const [, , originalAssetsArg = "backups/epic-1.01.4b/assets.dat"] = process.argv;
const EXPECTED_ORIGINAL_SHA256 =
  "3265599AE2CF79F650C22C33E56CE4DA83BF0655B24E67447208D3C7FAEEFC69";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function eventLabel(event) {
  switch (event?.[0]) {
    case 0:
      return "event";
    case 1:
      return `variable ${event?.[1]}`;
    case 3:
      return `group ${event?.[1]?.[1]}`;
    case 4:
      return `function ${event?.[1]?.[0]}`;
    default:
      return `type#${event?.[0]}`;
  }
}

function walkEvents(project) {
  const records = [];

  function walk(event, sheet, path, ancestors) {
    const scope = [...ancestors, eventLabel(event)];
    records.push({
      event,
      sheet,
      path,
      scope,
      conditions: Array.isArray(event?.[6]) ? event[6] : [],
      actions: Array.isArray(event?.[7]) ? event[7] : [],
    });

    const children = Array.isArray(event?.[8]) ? event[8] : [];
    children.forEach((child, index) =>
      walk(child, sheet, `${path}.${index}`, scope));
  }

  for (const sheet of project?.[6] ?? []) {
    const sheetName = sheet?.[0] ?? "<unnamed>";
    (sheet?.[1] ?? []).forEach((event, index) =>
      walk(event, sheetName, String(index), []));
  }

  return records;
}

const originalAssetsPath = resolve(originalAssetsArg);
const archive = parseArchive(originalAssetsPath);
const originalAssets = readEntry(archive, "data.json");
const runtime = readEntry(archive, "scripts/c3runtime.js");
const refSource = readEntry(archive, "scripts/objRefTable.js").toString("utf8");
const originalArchiveBuffer = readFileSync(originalAssetsPath);

assert.equal(
  sha256(originalArchiveBuffer),
  EXPECTED_ORIGINAL_SHA256,
  "hazard timing audit must run against the exact supported Epic 1.01.4b archive",
);

const root = JSON.parse(originalAssets.toString("utf8"));
const project = root.project;
assert.equal(project?.[16], "1.01.4", "internal project version");

const refs = [...refSource.matchAll(/^\s*(C3\.[^,\r\n]+),?\s*$/gm)].map(
  (match) => match[1],
);
const objectNames = new Map(
  (project?.[3] ?? []).map((object, index) => [
    index,
    object?.[0] ?? `object#${index}`,
  ]),
);
objectNames.set(-1, "System");
objectNames.set(-2, "Function");

function refName(statement) {
  if (typeof statement?.[1] === "string") {
    return `Function.${statement[1]}`;
  }
  return refs[statement?.[1]] ?? `ref#${statement?.[1]}`;
}

function describe(statement, kind) {
  return {
    object: objectNames.get(statement?.[0]) ?? `object#${statement?.[0]}`,
    ref: refName(statement),
    behavior: statement?.[2] ?? null,
    sid: statement?.[3] ?? null,
    params: statement?.[kind === "condition" ? 9 : 6] ?? [],
  };
}

const records = walkEvents(project);

function requireAction(sid, expected = {}) {
  const matches = [];
  for (const record of records) {
    for (const statement of record.actions) {
      if (statement?.[3] === sid) {
        matches.push({ record, statement, decoded: describe(statement, "action") });
      }
    }
  }

  assert.equal(matches.length, 1, `action SID ${sid} unique match count`);
  const match = matches[0];
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(match.decoded[key], value, `action SID ${sid} ${key}`);
  }
  return match;
}

function requireVariable(name, sid, initialValue, scopeName) {
  const matches = records.filter((record) =>
    record.event?.[0] === 1
    && record.event?.[1] === name
    && record.event?.[6] === sid
    && record.scope.includes(scopeName));
  assert.equal(matches.length, 1, `variable ${name} unique match count`);
  assert.equal(matches[0].event[3], initialValue, `variable ${name} initial value`);
  return matches[0];
}

const bombGroup = "group PIONS - Speciaux - bombe temps";
const bombWindow = requireVariable(
  "TempsExplosion",
  379611171026123,
  20,
  bombGroup,
).event[3];

for (const sid of [963953725912861, 418264141005715]) {
  const match = requireAction(sid, {
    object: "mstr_bombe",
    ref: "C3.Behaviors.Timer.Acts.StartTimer",
    behavior: "Timer",
  });
  assert.ok(match.record.scope.includes(bombGroup), `bomb timer SID ${sid} group`);
}

const bombDamage = requireAction(995531287212205, {
  object: "heros",
  ref: "C3.Plugins.Sprite.Acts.SubInstanceVar",
});
assert.ok(bombDamage.record.scope.includes(bombGroup), "bomb damage group");
assert.deepEqual(
  bombDamage.decoded.params,
  [[10, 8], [7, [4]]],
  "bomb explosion subtracts one hero health unit",
);

const wallGroup = "group pieges - murs";
const wallWindow = requireVariable(
  "tempsDispo",
  111250490893563,
  4.5,
  wallGroup,
).event[3];

for (const sid of [921711854324572, 877104320790567]) {
  const match = requireAction(sid, {
    object: "pion_murs_murs",
    ref: "C3.Behaviors.Tween.Acts.TweenOneProperty",
    behavior: "Tween",
  });
  assert.ok(match.record.scope.includes(wallGroup), `wall closing Tween SID ${sid} group`);
  assert.ok(
    JSON.stringify(match.decoded.params).includes("111250490893563"),
    `wall closing Tween SID ${sid} uses tempsDispo`,
  );
}

const wallDeadline = requireAction(464616384835886, {
  object: "Function",
  ref: "Function.murKill",
});
assert.ok(wallDeadline.record.scope.includes(wallGroup), "wall deadline group");
const wallDeadlineParentPath = wallDeadline.record.path.replace(/\.\d+$/, "");
const wallDeadlineParent = records.find((record) =>
  record.sheet === wallDeadline.record.sheet
  && record.path === wallDeadlineParentPath);
assert.ok(wallDeadlineParent, "wall deadline parent event");
assert.ok(
  wallDeadlineParent.conditions.some((condition) => {
    const decoded = describe(condition, "condition");
    return decoded.object === "pion_murs_murs"
      && decoded.ref === "C3.Behaviors.Tween.Cnds.OnTweensFinished"
      && decoded.behavior === "Tween";
  }),
  "wall deadline must be the Tween completion event",
);

const wallKill = requireAction(599419552536766, {
  object: "heros",
  ref: "C3.Plugins.Sprite.Acts.SetInstanceVar",
});
assert.ok(wallKill.record.scope.includes(wallGroup), "wall kill group");
assert.ok(wallKill.record.scope.includes("function murKill"), "wall kill function");
assert.deepEqual(
  wallKill.decoded.params,
  [[10, 8], [7, [22]]],
  "wall deadline sets hero health to zero",
);

const wallWaits = records.flatMap((record) =>
  record.scope.includes(wallGroup)
    ? record.actions
      .map((statement) => ({ record, decoded: describe(statement, "action") }))
      .filter(({ decoded }) => decoded.ref === "C3.Plugins.System.Acts.Wait")
    : []);
assert.ok(wallWaits.length > 0, "wall trap has auditable Wait actions");
assert.ok(
  wallWaits.every(({ decoded }) => decoded.params?.[1]?.[1] === true),
  "every wall-trap Wait must use scaled game time rather than wall time",
);

const wallObjectTimeScaleActions = records.flatMap((record) =>
  record.scope.includes(wallGroup)
    ? record.actions
      .map((statement) => describe(statement, "action"))
      .filter(({ ref }) => ref.endsWith("SetObjectTimescale")
        || ref.endsWith("RestoreObjectTimescale"))
    : []);
assert.equal(
  wallObjectTimeScaleActions.length,
  0,
  "wall trap must not override the global game time scale",
);

const runtimeText = runtime.toString("utf8");
const runtimeMarkers = [
  "this._dt=this._dt1*this._timeScale,this._gameTime.Add(this._dt)",
  "GetDt(e){return e&&-1!==e.GetTimeScale()?this._dt1*e.GetTimeScale():this._dt}",
  "Tick(){const e=this._runtime.GetDt(this._inst);for(const[t,r]of this._timers)r.IsPaused()||(r.Add(e),r.HasFinished()",
  "Wait(e,t){if(e<0)return;const n=this._runtime.GetEventSheetManager().AddScheduledWait();return t?n.InitTimer(e):n.InitWallTimer(e)",
  "Every(e){const t=this._runtime.GetCurrentCondition().GetSavedDataMap(),n=t.get(\"Every_lastTime\")||0,r=this._runtime.GetGameTime()",
  "const n=this._runtime.GetDt(this._inst);this._animationTimer.Add(n)",
  "this._useSystemTimescale=!0",
  "const t=this._runtime._GetDtFast(),s=this._runtime.GetDt1(),n=this._runtime.GetTimeScale()",
  "Tick(t,e,i){if(this.GetUseSystemTimescale())",
];
for (const marker of runtimeMarkers) {
  assert.ok(runtimeText.includes(marker), `Construct scaled-time marker: ${marker}`);
}

const focusRuntime = patchRuntime(
  runtime,
  "1.5",
  { enabled: true, key: "ShiftLeft", multiplier: 2 },
  { enabled: true, key: "ControlLeft", targetSpeed: 0.5 },
).toString("utf8");
for (const marker of [
  "_fastCestoFocusTarget=0.5",
  "this._fastCestoFocusActive?this._fastCestoFocusTarget:this._fastCestoMultiplier*(this._fastCestoTurboActive?this._fastCestoTurboMultiplier:1)",
]) {
  assert.ok(focusRuntime.includes(marker), `Focus runtime marker: ${marker}`);
}

function wallSeconds(gameSeconds, timeScale) {
  return gameSeconds / timeScale;
}

const result = {
  result: "passed",
  source: {
    build: project[16],
    assetsSha256: EXPECTED_ORIGINAL_SHA256,
  },
  focusTarget: 0.5,
  currentBaseSpeed: 1.5,
  hazards: {
    bomb: {
      internalGroup: "PIONS - Speciaux - bombe temps",
      gameSeconds: bombWindow,
      originalWallSeconds: wallSeconds(bombWindow, 1),
      currentBaseWallSeconds: wallSeconds(bombWindow, 1.5),
      focusWallSeconds: wallSeconds(bombWindow, 0.5),
    },
    wallHandTrap: {
      internalGroup: "pieges - murs",
      gameSeconds: wallWindow,
      deadline: "Tween completion -> murKill -> hero health 0",
      originalWallSeconds: wallSeconds(wallWindow, 1),
      currentBaseWallSeconds: wallSeconds(wallWindow, 1.5),
      focusWallSeconds: wallSeconds(wallWindow, 0.5),
      scaledWaitActionCount: wallWaits.length,
    },
  },
  reactionWindowRatios: {
    focusVsOriginal: 2,
    focusVsCurrentBase: 3,
  },
};

console.log(JSON.stringify(result, null, 2));
