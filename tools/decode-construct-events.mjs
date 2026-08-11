import { readFileSync } from "node:fs";

const [, , dataPath, refTablePath, sheetName = "jeu_code", groupName = "CAMERA"] = process.argv;

if (!dataPath || !refTablePath) {
  console.error(
    "Usage: node decode-construct-events.mjs <data.json> <objRefTable.js> [sheet-name] [group-name]",
  );
  process.exit(2);
}

const root = JSON.parse(readFileSync(dataPath, "utf8"));
const project = root.project;
const refSource = readFileSync(refTablePath, "utf8");
const refs = [...refSource.matchAll(/^\s*(C3\.[^,\r\n]+),?\s*$/gm)].map(
  (match) => match[1],
);

const objects = Array.isArray(project?.[3]) ? project[3] : [];
const objectNames = new Map(objects.map((object, index) => [index, object?.[0] ?? `object#${index}`]));
objectNames.set(-1, "System");
objectNames.set(-2, "Function");

function statementName(statement) {
  return refs[statement?.[1]] ?? `ref#${statement?.[1]}`;
}

function describeStatement(statement, kind) {
  const objectName = objectNames.get(statement?.[0]) ?? `object#${statement?.[0]}`;
  const behavior = statement?.[2] ? ` behavior=${statement[2]}` : "";
  const paramsIndex = kind === "condition" ? 9 : 6;
  const params = statement?.[paramsIndex] ?? [];
  return `${objectName}.${statementName(statement)}${behavior} params=${JSON.stringify(params)}`;
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

function printEvent(event, path, depth = 0) {
  const indent = "  ".repeat(depth);
  const conditions = Array.isArray(event?.[6]) ? event[6] : [];
  const actions = Array.isArray(event?.[7]) ? event[7] : [];
  const children = Array.isArray(event?.[8]) ? event[8] : [];
  console.log(
    `${indent}${path} ${eventLabel(event)} c=${conditions.length} a=${actions.length} child=${children.length}`,
  );

  for (const condition of conditions) {
    console.log(`${indent}  IF  ${describeStatement(condition, "condition")}`);
  }
  for (const action of actions) {
    console.log(`${indent}  DO  ${describeStatement(action, "action")}`);
  }
  for (let index = 0; index < children.length; index += 1) {
    printEvent(children[index], `${path}.${index}`, depth + 1);
  }
}

function findNamedEvent(events, wantedName) {
  for (const event of events) {
    if (event?.[0] === 3 && event?.[1]?.[1] === wantedName) {
      return event;
    }
    const children = Array.isArray(event?.[8]) ? event[8] : [];
    const nested = findNamedEvent(children, wantedName);
    if (nested) {
      return nested;
    }
  }
  return null;
}

const sheet = project?.[6]?.find((candidate) => candidate?.[0] === sheetName);
if (!sheet) {
  throw new Error(`Event sheet not found: ${sheetName}`);
}

const target = findNamedEvent(sheet[1] ?? [], groupName);
if (!target) {
  throw new Error(`Group not found in ${sheetName}: ${groupName}`);
}

printEvent(target, `${sheetName}/${groupName}`);
