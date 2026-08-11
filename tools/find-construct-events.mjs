import { readFileSync } from "node:fs";

const [, , dataPath, refTablePath, patternText] = process.argv;

if (!dataPath || !refTablePath || !patternText) {
  console.error(
    "Usage: node find-construct-events.mjs <data.json> <objRefTable.js> <regex>",
  );
  process.exit(2);
}

const root = JSON.parse(readFileSync(dataPath, "utf8"));
const project = root.project;
const refSource = readFileSync(refTablePath, "utf8");
const refs = [...refSource.matchAll(/^\s*(C3\.[^,\r\n]+),?\s*$/gm)].map(
  (match) => match[1],
);
const pattern = new RegExp(patternText, "i");
const objects = Array.isArray(project?.[3]) ? project[3] : [];
const objectNames = new Map(
  objects.map((object, index) => [index, object?.[0] ?? `object#${index}`]),
);
objectNames.set(-1, "System");
objectNames.set(-2, "Function");

function statementName(statement) {
  return refs[statement?.[1]] ?? `ref#${statement?.[1]}`;
}

function describeStatement(statement, kind) {
  const objectName = objectNames.get(statement?.[0]) ?? `object#${statement?.[0]}`;
  const paramsIndex = kind === "condition" ? 9 : 6;
  return {
    object: objectName,
    ref: statementName(statement),
    behavior: statement?.[2] ?? null,
    sid: statement?.[3] ?? null,
    params: statement?.[paramsIndex] ?? [],
  };
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

let matchCount = 0;

function walkEvent(event, sheetName, path, ancestors = []) {
  const conditions = Array.isArray(event?.[6]) ? event[6] : [];
  const actions = Array.isArray(event?.[7]) ? event[7] : [];
  const ownData = [event?.[0], event?.[1], conditions, actions];
  const decodedConditions = conditions.map((condition) =>
    describeStatement(condition, "condition"));
  const decodedActions = actions.map((action) => describeStatement(action, "action"));
  const searchable = JSON.stringify({
    ownData,
    decodedConditions,
    decodedActions,
  });

  if (pattern.test(searchable)) {
    matchCount += 1;
    console.log(JSON.stringify({
      sheet: sheetName,
      path,
      label: eventLabel(event),
      ancestors,
      conditions: decodedConditions,
      actions: decodedActions,
    }));
  }

  const children = Array.isArray(event?.[8]) ? event[8] : [];
  const nextAncestors = [...ancestors, eventLabel(event)];
  children.forEach((child, index) =>
    walkEvent(child, sheetName, `${path}.${index}`, nextAncestors));
}

for (const sheet of project?.[6] ?? []) {
  const sheetName = sheet?.[0] ?? "<unnamed>";
  (sheet?.[1] ?? []).forEach((event, index) =>
    walkEvent(event, sheetName, String(index), []));
}

console.error(`matches=${matchCount}`);
