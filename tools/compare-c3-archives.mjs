import { createHash } from "node:crypto";
import { parseArchive, readEntry } from "./c3-asset-archive.mjs";

const [, , leftPath, rightPath] = process.argv;
if (!leftPath || !rightPath) {
  console.error("Usage: node compare-c3-archives.mjs <left-assets.dat> <right-assets.dat>");
  process.exit(2);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

const left = parseArchive(leftPath);
const right = parseArchive(rightPath);
const leftNames = new Set(left.entries.map((entry) => entry.name));
const rightNames = new Set(right.entries.map((entry) => entry.name));
const added = [...rightNames].filter((name) => !leftNames.has(name));
const removed = [...leftNames].filter((name) => !rightNames.has(name));
const changed = [];

for (const name of [...leftNames].filter((candidate) => rightNames.has(candidate))) {
  const leftData = readEntry(left, name);
  const rightData = readEntry(right, name);
  if (!leftData.equals(rightData)) {
    changed.push({
      name,
      leftSize: leftData.length,
      rightSize: rightData.length,
      leftSha256: sha256(leftData),
      rightSha256: sha256(rightData),
    });
  }
}

console.log(JSON.stringify({
  leftEntryCount: left.entries.length,
  rightEntryCount: right.entries.length,
  added,
  removed,
  changed,
}, null, 2));
