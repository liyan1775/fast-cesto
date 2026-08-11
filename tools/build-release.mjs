import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "0.1.0-alpha.2";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIRECTORY = join(ROOT, "dist");
const OUTPUT_DIRECTORY = join(DIST_DIRECTORY, `fast-cesto-v${VERSION}`);
const ZIP_PATH = `${OUTPUT_DIRECTORY}.zip`;
const FILES = [
  "start-fast-cesto.cmd",
  "config/fast-cesto.default.json",
  "config/fast-cesto.recommended.json",
  "config/fast-cesto.turbo-preview.json",
  "ui/index.html",
  "ui/i18n.js",
  "ui/styles.css",
  "ui/app.js",
  "tools/c3-asset-archive.mjs",
  "tools/build-prototype.mjs",
  "tools/fast-cesto-diagnostics.mjs",
  "tools/fast-cesto-preflight.mjs",
  "tools/fast-cesto.mjs",
  "tools/diagnose-fast-cesto.mjs",
  "tools/fast-cesto-ui.mjs",
  "release/README.md",
  "release/PRIVACY.md",
  "release/KNOWN-ISSUES.md",
  "release/ALPHA-TESTING.md",
  "release/FEEDBACK-TEMPLATE.md",
];

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function requireGeneratedTarget(path) {
  const relativePath = relative(DIST_DIRECTORY, resolve(path));
  if (!relativePath || relativePath.startsWith("..") || relativePath.includes(`..${sep}`)) {
    throw new Error(`Refusing to modify a path outside dist: ${path}`);
  }
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

function auditRelease(directory) {
  const forbiddenNames = new Set([
    "assets.dat",
    "solcesto.exe",
    "package.json",
    "install-state.json",
    "operations.ndjson",
    "transaction.json",
    "operation.lock",
  ]);
  const forbiddenExtensions = new Set([".exe", ".dll", ".db", ".ldb", ".log"]);
  const rootText = ROOT.toLowerCase();
  const userProfile = (process.env.USERPROFILE ?? "").toLowerCase();
  const findings = [];
  for (const path of walk(directory)) {
    const name = basename(path).toLowerCase();
    const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    if (forbiddenNames.has(name) || forbiddenExtensions.has(extension)) {
      findings.push(`forbidden-file:${relative(directory, path)}`);
      continue;
    }
    if (statSync(path).size > 5 * 1024 * 1024) {
      findings.push(`oversized-file:${relative(directory, path)}`);
      continue;
    }
    const text = readFileSync(path, "utf8").toLowerCase();
    if (text.includes(rootText) || (userProfile && text.includes(userProfile))) {
      findings.push(`absolute-path:${relative(directory, path)}`);
    }
    if (/client[_-]?secret|access[_-]?token|refresh[_-]?token|private[_-]?key/.test(text)) {
      findings.push(`secret-pattern:${relative(directory, path)}`);
    }
  }
  if (findings.length) {
    throw new Error(`Release audit failed:\n${findings.join("\n")}`);
  }
  return { passed: true, fileCount: walk(directory).length };
}

requireGeneratedTarget(OUTPUT_DIRECTORY);
requireGeneratedTarget(ZIP_PATH);
mkdirSync(DIST_DIRECTORY, { recursive: true });
if (existsSync(OUTPUT_DIRECTORY)) rmSync(OUTPUT_DIRECTORY, { recursive: true, force: true });
if (existsSync(ZIP_PATH)) unlinkSync(ZIP_PATH);

for (const relativePath of FILES) {
  const source = join(ROOT, relativePath);
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Release input is missing: ${relativePath}`);
  }
  const destination = join(
    OUTPUT_DIRECTORY,
    relativePath.startsWith("release/") ? basename(relativePath) : relativePath,
  );
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

const manifestPath = join(OUTPUT_DIRECTORY, "release-manifest.json");
if (existsSync(manifestPath)) {
  unlinkSync(manifestPath);
}
const audit = auditRelease(OUTPUT_DIRECTORY);
const payloadFiles = walk(OUTPUT_DIRECTORY)
  .map((path) => ({
    path: relative(OUTPUT_DIRECTORY, path).replaceAll("\\", "/"),
    bytes: statSync(path).size,
    sha256: sha256File(path),
  }))
  .sort((left, right) => left.path.localeCompare(right.path));
writeFileSync(manifestPath, `${JSON.stringify({
  schemaVersion: 1,
  product: "Fast Cesto",
  version: VERSION,
  supportedGame: { store: "Epic Games Store", platform: "Windows", version: "1.01.3" },
  containsGameResources: false,
  createdAt: new Date().toISOString(),
  files: payloadFiles,
}, null, 2)}\n`, "utf8");

const archiveCommand = "Compress-Archive -Path (Join-Path $env:FAST_CESTO_RELEASE_SOURCE '*') -DestinationPath $env:FAST_CESTO_RELEASE_ZIP -CompressionLevel Optimal";
execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", archiveCommand], {
  windowsHide: true,
  stdio: "inherit",
  env: {
    ...process.env,
    FAST_CESTO_RELEASE_SOURCE: OUTPUT_DIRECTORY,
    FAST_CESTO_RELEASE_ZIP: ZIP_PATH,
  },
});

console.log(JSON.stringify({
  result: "release-built",
  version: VERSION,
  directory: OUTPUT_DIRECTORY,
  zip: ZIP_PATH,
  zipBytes: statSync(ZIP_PATH).size,
  zipSha256: sha256File(ZIP_PATH),
  auditedFileCount: audit.fileCount + 1,
}, null, 2));
