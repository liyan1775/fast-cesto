import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function waitForReady(child) {
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`Portable UI timed out: ${stderr}`)), 10_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const newline = stdout.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timer);
      try { resolvePromise(JSON.parse(stdout.slice(0, newline))); }
      catch (error) { reject(error); }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Portable UI exited before ready with ${code}: ${stderr}`));
    });
  });
}

async function post(origin, token, path, body) {
  return await fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": origin,
      "X-Fast-Cesto-Token": token,
    },
    body: JSON.stringify(body),
  });
}

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const zipPath = join(root, "dist", "fast-cesto-v0.1.0-alpha.1.zip");
const extractedDirectory = mkdtempSync(join(tmpdir(), "Fast Cesto Alpha 中文 空格-"));
const gameDirectory = join(root, "SolCesto");
const stateDirectory = join(root, "backups", "epic-1.01.3");
let child = null;

try {
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "Expand-Archive -LiteralPath $env:FAST_CESTO_ZIP -DestinationPath $env:FAST_CESTO_DESTINATION"],
    {
      windowsHide: true,
      env: {
        ...process.env,
        FAST_CESTO_ZIP: zipPath,
        FAST_CESTO_DESTINATION: extractedDirectory,
      },
    },
  );
  const serverPath = join(extractedDirectory, "tools", "fast-cesto-ui.mjs");
  child = spawn(
    process.execPath,
    [serverPath, gameDirectory, stateDirectory, "--no-open", "--port", "0"],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  const ready = await waitForReady(child);
  const page = await fetch(ready.url);
  const html = await page.text();
  const token = html.match(/name="fast-cesto-token" content="([^"]+)"/)?.[1];
  requireEqual(typeof token, "string", "portable session token");

  const bootstrap = await post(ready.url, token, "/api/bootstrap", {});
  const body = await bootstrap.json();
  requireEqual(bootstrap.status, 200, "portable bootstrap status");
  requireEqual(body.status.state, "installed", "portable installed state");
  requireEqual(body.preflight.readyToInstall, true, "portable preflight readiness");

  const diagnostic = await post(ready.url, token, "/api/diagnostic", {
    gameDirectory,
    stateDirectory,
  });
  const diagnosticText = await diagnostic.text();
  const report = JSON.parse(diagnosticText);
  requireEqual(diagnostic.status, 200, "portable diagnostic status");
  requireEqual(report.preflight.readyToInstall, true, "portable diagnostic preflight");
  requireEqual(diagnosticText.includes(root), false, "portable diagnostic omits workspace path");
  requireEqual(diagnosticText.includes(extractedDirectory), false, "portable diagnostic omits extraction path");

  const shutdown = await post(ready.url, token, "/api/shutdown", {});
  requireEqual(shutdown.status, 200, "portable shutdown status");
  console.log(JSON.stringify({
    result: "passed",
    extractedPathIncludesSpaces: extractedDirectory.includes(" "),
    extractedPathIncludesNonAscii: /[^\x00-\x7F]/.test(extractedDirectory),
  }, null, 2));
} finally {
  if (child?.exitCode === null) child.kill();
  rmSync(extractedDirectory, { recursive: true, force: true });
}
