import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = join(root, "dist", "fast-cesto-v0.1.0-alpha.1");
const zipPath = `${directory}.zip`;
requireEqual(existsSync(directory), true, "release directory exists");
requireEqual(existsSync(zipPath), true, "release zip exists");
requireEqual(statSync(zipPath).size > 0, true, "release zip non-empty");

const files = walk(directory);
const lowerNames = files.map((path) => basename(path).toLowerCase());
for (const forbidden of ["assets.dat", "solcesto.exe", "package.json", "install-state.json", "operations.ndjson"]) {
  requireEqual(lowerNames.includes(forbidden), false, `forbidden ${forbidden}`);
}
for (const required of ["start-fast-cesto.cmd", "release-manifest.json", "README.md", "PRIVACY.md", "KNOWN-ISSUES.md"]) {
  requireEqual(lowerNames.includes(required.toLowerCase()), true, `required ${required}`);
}
const manifest = JSON.parse(readFileSync(join(directory, "release-manifest.json"), "utf8"));
requireEqual(manifest.version, "0.1.0-alpha.1", "manifest version");
requireEqual(manifest.containsGameResources, false, "manifest resource declaration");
requireEqual(manifest.files.length, files.length - 1, "manifest payload count");
const payloadByPath = new Map(
  files
    .filter((path) => basename(path) !== "release-manifest.json")
    .map((path) => [relative(directory, path).replaceAll("\\", "/"), path]),
);
for (const entry of manifest.files) {
  const path = payloadByPath.get(entry.path);
  requireEqual(typeof path, "string", `manifest path ${entry.path}`);
  requireEqual(statSync(path).size, entry.bytes, `manifest size ${entry.path}`);
  requireEqual(sha256File(path), entry.sha256, `manifest hash ${entry.path}`);
}
console.log(JSON.stringify({ result: "passed", fileCount: files.length, zipBytes: statSync(zipPath).size }, null, 2));
