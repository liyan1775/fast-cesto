import { readFileSync } from "node:fs";

const [, , inputPath, patternText = "camera|zoom|timescale|shake|option"] = process.argv;

if (!inputPath) {
  console.error("Usage: node analyze-construct-data.mjs <data.json> [regex]");
  process.exit(2);
}

const root = JSON.parse(readFileSync(inputPath, "utf8"));
const pattern = new RegExp(patternText, "i");
const project = root.project;

if (!Array.isArray(project)) {
  throw new Error("Input does not look like Construct 3 data.json");
}

console.log(JSON.stringify({
  projectName: project[0],
  firstLayout: project[1],
  version: project[16],
  exportTimestamp: project[36],
  eventSheets: Array.isArray(project[6])
    ? project[6].map((sheet, index) => ({
        index,
        name: sheet?.[0],
        itemCount: Array.isArray(sheet?.[1]) ? sheet[1].length : null,
      }))
    : [],
}, null, 2));

function compactPreview(value, limit = 700) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function walk(value, path = [], ancestors = []) {
  if (typeof value === "string") {
    if (pattern.test(value)) {
      const parent = ancestors.at(-1);
      const grandparent = ancestors.at(-2);
      console.log(JSON.stringify({
        kind: "string-match",
        path,
        value,
        parent: compactPreview(parent),
        grandparent: compactPreview(grandparent),
      }));
    }
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)
      && value[0] === 3
      && Array.isArray(value[1])
      && typeof value[1][1] === "string"
      && pattern.test(value[1][1])) {
    console.log(JSON.stringify({
      kind: "group-match",
      path,
      name: value[1][1],
      preview: compactPreview(value, 1200),
    }));
  }

  const nextAncestors = [...ancestors.slice(-2), value];

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      walk(value[index], [...path, index], nextAncestors);
    }
  } else {
    for (const [key, child] of Object.entries(value)) {
      walk(child, [...path, key], nextAncestors);
    }
  }
}

walk(root);
