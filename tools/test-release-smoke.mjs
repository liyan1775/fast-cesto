import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function waitForReady(child) {
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`Release UI timed out: ${stderr}`)), 10_000);
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
      reject(new Error(`Release UI exited before ready with ${code}: ${stderr}`));
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
const serverPath = resolve(root, "dist", "fast-cesto-v0.1.0-alpha.2", "tools", "fast-cesto-ui.mjs");
const gameDirectory = resolve(root, "SolCesto");
const stateDirectory = resolve(root, "backups", "epic-1.01.3");
const child = spawn(
  process.execPath,
  [serverPath, gameDirectory, stateDirectory, "--no-open", "--port", "0"],
  { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);

try {
  const ready = await waitForReady(child);
  const page = await fetch(ready.url);
  const html = await page.text();
  const token = html.match(/name="fast-cesto-token" content="([^"]+)"/)?.[1];
  requireEqual(typeof token, "string", "release session token");
  const bootstrap = await post(ready.url, token, "/api/bootstrap", {});
  const body = await bootstrap.json();
  requireEqual(bootstrap.status, 200, "release bootstrap status");
  requireEqual(body.status.state, "installed", "release detects installed state");
  requireEqual(body.status.backupValid, true, "release detects valid backup");
  requireEqual(body.status.activeConfig.turbo.enabled, true, "release detects Turbo");
  requireEqual(body.status.activeConfig.turbo.key, "ShiftLeft", "release detects Turbo key");
  requireEqual(body.preflight.readyToInstall, true, "release preflight readiness");
  requireEqual(body.preflight.blockingIssueIds.length, 0, "release preflight blocking count");
  const shutdown = await post(ready.url, token, "/api/shutdown", {});
  requireEqual(shutdown.status, 200, "release shutdown status");
  console.log(JSON.stringify({ result: "passed", currentSha256: body.status.currentSha256 }, null, 2));
} finally {
  if (child.exitCode === null) child.kill();
}
