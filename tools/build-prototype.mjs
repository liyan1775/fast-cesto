import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseArchive,
  readEntry,
  repackArchive,
} from "./c3-asset-archive.mjs";

export const SUPPORTED = {
  gameVersion: "1.01.3",
  assetsSha256: "EAFD1E359A0804D28F174D6ECADB587BF44CC849A74839F06ABDBF4CAB88B5DD",
  runtimeSha256: "E6EC7BF9B4E8B1C00A9B3F96387B691A70BBA6EC2D2CAF42D409C54CC739AB32",
  dataSha256: "57D83801624B4175D2C8647654FC6092E9C6001924E34772B154C76A8E6DA3B2",
};

const MOVE_ZOOM_ACTION_SID = 938984979377417;
const VALID_SPEEDS = new Set(["1", "1.25", "1.5", "2"]);
const VALID_GOLD_MULTIPLIERS = new Set(["1", "2", "3"]);
const GOLD_REWARD_ACTIONS = [
  // Bank all run gold at normal biome/end transitions.
  [492396951510410, 0, "run-transfer"],
  [239747105337166, 2, "run-transfer-total"],
  [382061575084194, 0, "run-transfer"],
  [592416379865025, 2, "run-transfer-total"],
  [376173260635758, 0, "run-transfer"],
  [840222105993060, 2, "run-transfer-total"],
  [780444011255011, 0, "run-transfer"],
  [786626143464346, 2, "run-transfer-total"],
  [683328600888089, 0, "run-transfer"],
  [962141948090510, 2, "run-transfer-total"],
  [433660052194454, 0, "run-transfer"],
  [200694809864626, 2, "run-transfer-total"],
  // Bank the amount retained after death modifiers.
  [229285866952164, 0, "death-retained"],
  [563395270249669, 2, "death-retained-total"],
  [432121368863826, 0, "death-retained"],
  [253011860438001, 2, "death-retained-total"],
  [716019112815350, 0, "death-retained"],
  [782637687459691, 2, "death-retained-total"],
  // Directly banked coins and item-sale proceeds.
  [748662311631725, 0, "direct-bank"],
  [528252996516544, 0, "direct-bank"],
].map(([sid, variableIndex, category], index) => ({
  sid,
  variableIndex,
  category,
  cloneSidBase: 610000000000000 + index * 10,
}));

function usage() {
  console.error(
    "Usage: node build-prototype.mjs <SolCesto-directory> [output-directory] [speed: 1|1.25|1.5|2] [gold-multiplier: 1|2|3] [disable-movement-zoom: true|false]",
  );
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

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  const last = source.lastIndexOf(needle);
  if (first === -1) {
    throw new Error(`Patch point not found: ${label}`);
  }
  if (first !== last) {
    throw new Error(`Patch point is ambiguous: ${label}`);
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

export function patchRuntime(buffer, speed, turbo = { enabled: false }) {
  let source = buffer.toString("utf8");
  const turboEnabled = turbo?.enabled === true;
  const turboKey = turbo?.key ?? "ShiftLeft";
  const turboMultiplier = turbo?.multiplier ?? 2;
  const initialTimeScalePatch = turboEnabled
    ? `this._timeScale=${speed},this._fastCestoMultiplier=${speed},this._fastCestoBaseTimeScale=1,this._fastCestoTurboMultiplier=${turboMultiplier},this._fastCestoTurboActive=!1,this._fastCestoSetTurbo=e=>{e=!!e,e!==this._fastCestoTurboActive&&(this._fastCestoTurboActive=e,this._timeScale=this._fastCestoBaseTimeScale*this._fastCestoMultiplier*(e?this._fastCestoTurboMultiplier:1),this._fastCestoTurboStatusText&&this._fastCestoTurboStatusText.SetText(e?"Fast Cesto Turbo on":"Fast Cesto Turbo off"))},this._maxDt=1/30`
    : `this._timeScale=${speed},this._fastCestoMultiplier=${speed},this._fastCestoBaseTimeScale=1,this._maxDt=1/30`;
  source = replaceOnce(
    source,
    "this._timeScale=1,this._maxDt=1/30",
    initialTimeScalePatch,
    "runtime initial time scale",
  );
  source = replaceOnce(
    source,
    "SetTimeScale(e){(isNaN(e)||e<0)&&(e=0),this._timeScale=e}",
    turboEnabled
      ? "SetTimeScale(e){(isNaN(e)||e<0)&&(e=0),this._fastCestoBaseTimeScale=e,this._timeScale=e*this._fastCestoMultiplier*(this._fastCestoTurboActive?this._fastCestoTurboMultiplier:1)}"
      : "SetTimeScale(e){(isNaN(e)||e<0)&&(e=0),this._fastCestoBaseTimeScale=e,this._timeScale=e*this._fastCestoMultiplier}",
    "runtime time-scale setter",
  );
  source = replaceOnce(
    source,
    '"timescale":this.GetTimeScale()',
    '"timescale":this._fastCestoBaseTimeScale',
    "runtime save-state base time scale",
  );
  source = replaceOnce(
    source,
    'this._timeScale=i["timescale"]',
    turboEnabled
      ? 'this._fastCestoBaseTimeScale=i["timescale"],this._fastCestoTurboActive=!1,this._timeScale=this._fastCestoBaseTimeScale*this._fastCestoMultiplier,this._fastCestoTurboStatusText&&this._fastCestoTurboStatusText.SetText("Fast Cesto Turbo off")'
      : 'this._fastCestoBaseTimeScale=i["timescale"],this._timeScale=this._fastCestoBaseTimeScale*this._fastCestoMultiplier',
    "runtime load-state base time scale",
  );
  if (turboEnabled) {
    const dispatcherNeedle = "this._dispatcher.addEventListener(\"window-blur\",e=>this._OnWindowBlur(e)),this._dispatcher.addEventListener(\"window-focus\",()=>this._OnWindowFocus())";
    const keyLiteral = JSON.stringify(turboKey);
    const turboDispatcherPatch = `this._fastCestoTurboStatusText=new C3.ScreenReaderText(this,"Fast Cesto Turbo off"),this._dispatcher.addEventListener("keydown",e=>{e.data&&e.data["code"]===${keyLiteral}&&this._fastCestoSetTurbo(!0)}),this._dispatcher.addEventListener("keyup",e=>{e.data&&e.data["code"]===${keyLiteral}&&this._fastCestoSetTurbo(!1)}),this._dispatcher.addEventListener("window-blur",()=>this._fastCestoSetTurbo(!1)),this._dispatcher.addEventListener("keyboard-blur",()=>this._fastCestoSetTurbo(!1)),this._dispatcher.addEventListener("suspend",()=>this._fastCestoSetTurbo(!1)),${dispatcherNeedle}`;
    source = replaceOnce(
      source,
      dispatcherNeedle,
      turboDispatcherPatch,
      "runtime Turbo dispatcher",
    );
  }
  return Buffer.from(source, "utf8");
}

function findFunction(events, name) {
  for (const event of events) {
    if (event?.[0] === 4 && event?.[1]?.[0] === name) {
      return event;
    }
    const child = findFunction(Array.isArray(event?.[8]) ? event[8] : [], name);
    if (child) {
      return child;
    }
  }
  return null;
}

function removeActionBySid(event, sid, matches = []) {
  const actions = Array.isArray(event?.[7]) ? event[7] : [];
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (actions[index]?.[3] === sid) {
      matches.push(actions[index]);
      actions.splice(index, 1);
    }
  }
  for (const child of Array.isArray(event?.[8]) ? event[8] : []) {
    removeActionBySid(child, sid, matches);
  }
  return matches;
}

function collectStatementSids(events, sids = new Set()) {
  for (const event of events) {
    for (const statement of [
      ...(Array.isArray(event?.[6]) ? event[6] : []),
      ...(Array.isArray(event?.[7]) ? event[7] : []),
    ]) {
      if (Number.isSafeInteger(statement?.[3])) {
        sids.add(statement[3]);
      }
    }
    collectStatementSids(Array.isArray(event?.[8]) ? event[8] : [], sids);
  }
  return sids;
}

function expectedGoldExpression(category) {
  if (category.startsWith("run-transfer")) {
    return [112, [2, 64, false, 10]];
  }
  if (category.startsWith("death-retained")) {
    return [1835, [2, 64, false, 10]];
  }
  if (category === "direct-bank") {
    return [4];
  }
  throw new Error(`Unknown gold reward category: ${category}`);
}

function duplicateGoldRewardActions(events, metaProgressionIndex, multiplier) {
  const targets = new Map(GOLD_REWARD_ACTIONS.map((target) => [target.sid, target]));
  const existingSids = collectStatementSids(events);
  const matches = [];
  const cloneActionSids = [];

  function visit(eventList) {
    for (const event of eventList) {
      const actions = Array.isArray(event?.[7]) ? event[7] : [];
      const patchedActions = [];
      for (const action of actions) {
        patchedActions.push(action);
        const target = targets.get(action?.[3]);
        if (!target) {
          continue;
        }
        if (action?.[0] !== metaProgressionIndex || action?.[1] !== 121) {
          throw new Error(`Gold action ${target.sid} no longer targets metaProgression.AddInstanceVar`);
        }
        if (action?.[6]?.[0]?.[0] !== 10 || action[6][0][1] !== target.variableIndex) {
          throw new Error(`Gold action ${target.sid} targets an unexpected instance variable`);
        }
        const actualExpression = action?.[6]?.[1]?.[1];
        if (JSON.stringify(actualExpression) !== JSON.stringify(expectedGoldExpression(target.category))) {
          throw new Error(`Gold action ${target.sid} has an unexpected reward expression`);
        }

        matches.push(target);
        for (let copyIndex = 1; copyIndex < multiplier; copyIndex += 1) {
          const clone = structuredClone(action);
          const cloneSid = target.cloneSidBase + copyIndex;
          if (existingSids.has(cloneSid)) {
            throw new Error(`Generated gold action SID already exists: ${cloneSid}`);
          }
          existingSids.add(cloneSid);
          clone[3] = cloneSid;
          patchedActions.push(clone);
          cloneActionSids.push(cloneSid);
        }
      }
      if (actions.length > 0) {
        event[7] = patchedActions;
      }
      visit(Array.isArray(event?.[8]) ? event[8] : []);
    }
  }

  visit(events);
  if (matches.length !== GOLD_REWARD_ACTIONS.length) {
    const found = new Set(matches.map((target) => target.sid));
    const missing = GOLD_REWARD_ACTIONS
      .filter((target) => !found.has(target.sid))
      .map((target) => target.sid);
    throw new Error(
      `Expected ${GOLD_REWARD_ACTIONS.length} gold actions, found ${matches.length}; missing ${missing.join(", ")}`,
    );
  }
  if (new Set(matches.map((target) => target.sid)).size !== matches.length) {
    throw new Error("A gold reward action SID matched more than once");
  }

  return {
    targetActionSids: matches.map((target) => target.sid),
    cloneActionSids,
  };
}

export function patchData(buffer, goldMultiplier, disableMovementZoom = true) {
  const root = JSON.parse(buffer.toString("utf8"));
  const sheet = root.project?.[6]?.find((candidate) => candidate?.[0] === "jeu_code");
  if (!sheet) {
    throw new Error("jeu_code event sheet not found");
  }
  const zoomFunction = findFunction(sheet[1] ?? [], "camera_zoomCase");
  if (!zoomFunction) {
    throw new Error("camera_zoomCase function not found");
  }

  let removedActionSid = null;
  if (disableMovementZoom) {
    const matches = removeActionBySid(zoomFunction, MOVE_ZOOM_ACTION_SID);
    if (matches.length !== 1) {
      throw new Error(
        `Expected one movement-zoom action, removed ${matches.length}`,
      );
    }
    const [removed] = matches;
    if (removed?.[0] !== 12 || removed?.[1] !== 85 || removed?.[2] !== "Tween") {
      throw new Error("Movement-zoom action no longer has the expected shape");
    }
    removedActionSid = MOVE_ZOOM_ACTION_SID;
  }

  const metaProgressionIndex = root.project?.[3]?.findIndex(
    (object) => object?.[0] === "metaProgression",
  );
  if (metaProgressionIndex < 0) {
    throw new Error("metaProgression object not found");
  }
  const goldPatch = duplicateGoldRewardActions(
    root.project?.[6]?.flatMap((candidate) => candidate?.[1] ?? []) ?? [],
    metaProgressionIndex,
    goldMultiplier,
  );

  return {
    buffer: Buffer.from(JSON.stringify(root), "utf8"),
    removedActionSid,
    goldPatch,
  };
}

async function main() {
  const [
    ,
    ,
    gameDirectoryArg,
    outputDirectoryArg,
    speed = "1.5",
    goldMultiplierText = "1",
    disableMovementZoomText = "true",
  ] = process.argv;
  if (!gameDirectoryArg) {
    usage();
    process.exit(2);
  }
  if (!VALID_SPEEDS.has(speed)) {
    throw new Error(`Unsupported speed: ${speed}`);
  }
  if (!VALID_GOLD_MULTIPLIERS.has(goldMultiplierText)) {
    throw new Error(`Unsupported gold multiplier: ${goldMultiplierText}`);
  }
  if (!["true", "false"].includes(disableMovementZoomText)) {
    throw new Error(`Unsupported disable-movement-zoom value: ${disableMovementZoomText}`);
  }
  const goldMultiplier = Number(goldMultiplierText);
  const disableMovementZoom = disableMovementZoomText === "true";

  const gameDirectory = resolve(gameDirectoryArg);
  const assetsPath = join(gameDirectory, "www", "assets.dat");
  const outputDirectory = resolve(
    outputDirectoryArg ?? join(
      "build",
      `prototype-${SUPPORTED.gameVersion}-speed-${speed}-gold-${goldMultiplier}-${disableMovementZoom ? "no-move-zoom" : "original-move-zoom"}`,
    ),
  );
  const outputAssetsPath = join(outputDirectory, "assets.dat");
  const payloadDirectory = join(outputDirectory, "payloads");
  const runtimeOutputPath = join(payloadDirectory, "c3runtime.js");
  const dataOutputPath = join(payloadDirectory, "data.json");

  if (existsSync(outputDirectory)) {
    throw new Error(`Output directory already exists: ${outputDirectory}`);
  }

  const originalAssetsSha256 = await sha256File(assetsPath);
  if (originalAssetsSha256 !== SUPPORTED.assetsSha256) {
    throw new Error(
      `Unsupported assets.dat: expected ${SUPPORTED.assetsSha256}, got ${originalAssetsSha256}`,
    );
  }

  const archive = parseArchive(assetsPath);
  const runtime = readEntry(archive, "scripts/c3runtime.js");
  const data = readEntry(archive, "data.json");
  if (sha256Buffer(runtime) !== SUPPORTED.runtimeSha256) {
    throw new Error("Internal scripts/c3runtime.js hash does not match the supported build");
  }
  if (sha256Buffer(data) !== SUPPORTED.dataSha256) {
    throw new Error("Internal data.json hash does not match the supported build");
  }

  const patchedRuntime = patchRuntime(runtime, speed);
  const patchedData = patchData(data, goldMultiplier, disableMovementZoom);

  mkdirSync(dirname(outputDirectory), { recursive: true });
  mkdirSync(payloadDirectory, { recursive: true });
  writeFileSync(runtimeOutputPath, patchedRuntime, { flag: "wx" });
  writeFileSync(dataOutputPath, patchedData.buffer, { flag: "wx" });
  repackArchive(archive, outputAssetsPath, [
    ["scripts/c3runtime.js", runtimeOutputPath],
    ["data.json", dataOutputPath],
  ]);

  const outputArchive = parseArchive(outputAssetsPath);
  const manifest = {
    prototype: "Fast Cesto technical prototype",
    gameVersion: SUPPORTED.gameVersion,
    settings: {
      speed: Number(speed),
      disableMovementZoom,
      goldMultiplier,
    },
    compatibility: {
      originalAssetsSha256,
      originalRuntimeSha256: SUPPORTED.runtimeSha256,
      originalDataSha256: SUPPORTED.dataSha256,
    },
    output: {
      assetsSha256: await sha256File(outputAssetsPath),
      runtimeSha256: sha256Buffer(patchedRuntime),
      dataSha256: sha256Buffer(patchedData.buffer),
      entryCount: outputArchive.entries.length,
      removedMovementZoomActionSid: patchedData.removedActionSid,
      goldRewardPatch: {
        scope: "Earned and banked run gold only; excludes loads, spending, official offers, and story grants.",
        targetActionCount: patchedData.goldPatch.targetActionSids.length,
        duplicatedActionCount: patchedData.goldPatch.cloneActionSids.length,
        targetActionSids: patchedData.goldPatch.targetActionSids,
        cloneActionSids: patchedData.goldPatch.cloneActionSids,
      },
    },
    note: "Local test artifact only. Do not distribute this full assets.dat file.",
  };
  writeFileSync(
    join(outputDirectory, "prototype.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" },
  );
  console.log(JSON.stringify({ outputDirectory, ...manifest }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  });
}
