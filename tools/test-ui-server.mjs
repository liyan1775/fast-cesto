import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function waitForReady(child) {
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`UI server timed out: ${stderr}`)), 10_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const newline = stdout.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timer);
      try {
        resolvePromise(JSON.parse(stdout.slice(0, newline)));
      } catch (error) {
        reject(error);
      }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`UI server exited before ready with ${code}: ${stderr}`));
    });
  });
}

async function post(origin, token, path, body) {
  return await fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": origin,
      ...(token ? { "X-Fast-Cesto-Token": token } : {}),
    },
    body: JSON.stringify(body),
  });
}

const root = mkdtempSync(join(tmpdir(), "fast-cesto-ui-test-"));
const gameDirectory = join(root, "game");
const stateDirectory = join(root, "state");
const assetsPath = join(gameDirectory, "www", "assets.dat");
mkdirSync(join(gameDirectory, "www"), { recursive: true });
mkdirSync(stateDirectory);
writeFileSync(assetsPath, `fake-archive-${randomUUID()}`, { flag: "wx" });

const serverPath = fileURLToPath(new URL("./fast-cesto-ui.mjs", import.meta.url));
const child = spawn(process.execPath, [serverPath, "--no-open", "--port", "0"], {
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  const ready = await waitForReady(child);
  requireEqual(ready.result, "ui-ready", "server ready result");
  const origin = ready.url;

  const health = await fetch(`${origin}/api/health`);
  requireEqual(health.status, 200, "health status");
  requireEqual((await health.json()).ok, true, "health body");

  const page = await fetch(origin);
  const html = await page.text();
  requireEqual(page.status, 200, "page status");
  requireEqual(page.headers.get("content-security-policy")?.includes("default-src 'self'"), true, "page CSP");
  requireEqual(html.includes("Fast Cesto"), true, "page title");
  const token = html.match(/name="fast-cesto-token" content="([^"]+)"/)?.[1];
  requireEqual(typeof token, "string", "session token present");

  const unauthorized = await post(origin, null, "/api/status", { gameDirectory, stateDirectory });
  requireEqual(unauthorized.status, 403, "unauthorized request");

  const bootstrap = await post(origin, token, "/api/bootstrap", { gameDirectory, stateDirectory });
  const bootstrapBody = await bootstrap.json();
  requireEqual(bootstrap.status, 200, "bootstrap status");
  requireEqual(bootstrapBody.status.state, "unknown", "fake archive classification");
  requireEqual(bootstrapBody.preflight.readyToInstall, false, "fake archive preflight");
  requireEqual(
    bootstrapBody.preflight.blockingIssueIds.includes("SUPPORTED_ARCHIVE"),
    true,
    "fake archive preflight reason",
  );

  const before = readFileSync(assetsPath, "utf8");
  const invalidInstall = await post(origin, token, "/api/install", {
    gameDirectory,
    stateDirectory,
    settings: {
      speed: 9,
      disableMovementZoom: true,
      goldMultiplier: 2,
      turbo: { enabled: false, key: "ShiftLeft", multiplier: 2 },
    },
  });
  requireEqual(invalidInstall.status, 400, "invalid install status");
  requireEqual(readFileSync(assetsPath, "utf8"), before, "invalid install leaves archive unchanged");

  const diagnostic = await post(origin, token, "/api/diagnostic", { gameDirectory, stateDirectory });
  const reportText = await diagnostic.text();
  const report = JSON.parse(reportText);
  requireEqual(diagnostic.status, 200, "diagnostic status");
  requireEqual(report.privacy.pathsIncluded, false, "diagnostic path privacy");
  requireEqual(report.preflight.readyToInstall, false, "diagnostic preflight result");
  requireEqual(reportText.includes(root), false, "diagnostic omits test path");

  const traversal = await fetch(`${origin}/tools/fast-cesto.mjs`);
  requireEqual(traversal.status, 404, "static allowlist");

  const shutdown = await post(origin, token, "/api/shutdown", {});
  requireEqual(shutdown.status, 200, "shutdown status");
  console.log(JSON.stringify({ result: "passed" }, null, 2));
} finally {
  if (child.exitCode === null) child.kill();
  rmSync(root, { recursive: true, force: true });
}
