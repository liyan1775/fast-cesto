import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDiagnosticReport,
  recordOperation,
} from "./fast-cesto-diagnostics.mjs";
import { createPreflightReport } from "./fast-cesto-preflight.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UI_DIRECTORY = join(ROOT, "ui");
const CLI_PATH = join(ROOT, "tools", "fast-cesto.mjs");
const DEFAULT_GAME_DIRECTORY = resolve(process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2]
  : join(ROOT, "SolCesto"));
const DEFAULT_STATE_DIRECTORY = resolve(process.argv[3] && !process.argv[3].startsWith("--")
  ? process.argv[3]
  : join(ROOT, "backups", "epic-1.01.3"));
const noOpen = process.argv.includes("--no-open");
const requestedPortIndex = process.argv.indexOf("--port");
const requestedPort = requestedPortIndex >= 0 ? Number(process.argv[requestedPortIndex + 1]) : 0;
const sessionToken = randomUUID();
let origin = null;
let operationActive = false;

const STATIC_FILES = new Map([
  ["/", { path: join(UI_DIRECTORY, "index.html"), type: "text/html; charset=utf-8" }],
  ["/app.js", { path: join(UI_DIRECTORY, "app.js"), type: "text/javascript; charset=utf-8" }],
  ["/i18n.js", { path: join(UI_DIRECTORY, "i18n.js"), type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { path: join(UI_DIRECTORY, "styles.css"), type: "text/css; charset=utf-8" }],
]);

function sendJson(response, statusCode, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function sendText(response, statusCode, body, type = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let bytes = 0;
    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 32 * 1024) {
        reject(new Error("Request body is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function validateDirectory(value, label) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 1024) {
    throw new Error(`${label} is required`);
  }
  return resolve(value.trim());
}

function validateSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Settings are required");
  }
  if (![1, 1.25, 1.5, 2].includes(value.speed)) {
    throw new Error("Unsupported speed");
  }
  if (typeof value.disableMovementZoom !== "boolean") {
    throw new Error("Movement Zoom setting must be true or false");
  }
  if (![1, 2, 3].includes(value.goldMultiplier)) {
    throw new Error("Unsupported gold multiplier");
  }
  if (typeof value.turbo?.enabled !== "boolean") {
    throw new Error("Turbo enabled setting must be true or false");
  }
  if (!["ShiftLeft", "ShiftRight"].includes(value.turbo.key)) {
    throw new Error("Unsupported Turbo key");
  }
  if (![1.5, 2, 3].includes(value.turbo.multiplier)) {
    throw new Error("Unsupported Turbo multiplier");
  }
  return {
    schemaVersion: 2,
    gameVersion: "1.01.3",
    speed: value.speed,
    disableMovementZoom: value.disableMovementZoom,
    goldMultiplier: value.goldMultiplier,
    turbo: {
      enabled: value.turbo.enabled,
      key: value.turbo.key,
      multiplier: value.turbo.multiplier,
    },
  };
}

function runCli(argumentsList) {
  return new Promise((resolvePromise, reject) => {
    execFile(
      process.execPath,
      [CLI_PATH, ...argumentsList],
      { encoding: "utf8", windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr.trim().split(/\r?\n/)[0] || "Fast Cesto operation failed";
          reject(new Error(message, { cause: error }));
          return;
        }
        try {
          resolvePromise(JSON.parse(stdout));
        } catch (parseError) {
          reject(new Error("Fast Cesto returned an invalid response", { cause: parseError }));
        }
      },
    );
  });
}

async function collectStatus(gameDirectory, stateDirectory) {
  return await runCli(["status", gameDirectory, stateDirectory]);
}

async function collectStatusAndPreflight(gameDirectory, stateDirectory) {
  const status = await collectStatus(gameDirectory, stateDirectory);
  const preflight = createPreflightReport({ gameDirectory, stateDirectory, status });
  return { status, preflight };
}

function requireAuthorizedRequest(request) {
  return request.headers.origin === origin
    && request.headers["x-fast-cesto-token"] === sessionToken
    && request.headers["content-type"]?.split(";", 1)[0] === "application/json";
}

async function withExclusiveOperation(response, operation) {
  if (operationActive) {
    sendJson(response, 409, { ok: false, error: "Another UI operation is still running" });
    return;
  }
  operationActive = true;
  try {
    await operation();
  } finally {
    operationActive = false;
  }
}

const server = createServer(async (request, response) => {
  try {
    const expectedHost = new URL(origin).host;
    if (request.headers.host !== expectedHost) {
      sendJson(response, 403, { ok: false, error: "Invalid host" });
      return;
    }
    const url = new URL(request.url, origin);
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, product: "Fast Cesto internal alpha" });
      return;
    }
    if (request.method === "GET" && STATIC_FILES.has(url.pathname)) {
      const file = STATIC_FILES.get(url.pathname);
      let body = readFileSync(file.path, "utf8");
      if (url.pathname === "/") {
        body = body.replace("__FAST_CESTO_SESSION_TOKEN__", sessionToken);
      }
      sendText(response, 200, body, file.type);
      return;
    }
    if (request.method !== "POST" || !url.pathname.startsWith("/api/")) {
      sendJson(response, 404, { ok: false, error: "Not found" });
      return;
    }
    if (!requireAuthorizedRequest(request)) {
      sendJson(response, 403, { ok: false, error: "Unauthorized local request" });
      return;
    }
    const body = await readBody(request);

    if (url.pathname === "/api/bootstrap") {
      const gameDirectory = body.gameDirectory
        ? validateDirectory(body.gameDirectory, "Game directory")
        : DEFAULT_GAME_DIRECTORY;
      const stateDirectory = body.stateDirectory
        ? validateDirectory(body.stateDirectory, "State directory")
        : DEFAULT_STATE_DIRECTORY;
      let status = null;
      let preflight = null;
      let error = null;
      try {
        ({ status, preflight } = await collectStatusAndPreflight(gameDirectory, stateDirectory));
      } catch (statusError) {
        error = statusError.message;
      }
      sendJson(response, 200, {
        ok: true,
        defaults: { gameDirectory, stateDirectory },
        status,
        preflight,
        error,
      });
      return;
    }

    if (url.pathname === "/api/shutdown") {
      sendJson(response, 200, { ok: true, result: "shutting-down" });
      setTimeout(() => server.close(() => process.exit(0)), 20);
      return;
    }

    const gameDirectory = validateDirectory(body.gameDirectory, "Game directory");
    const stateDirectory = validateDirectory(body.stateDirectory, "State directory");

    if (url.pathname === "/api/status") {
      await withExclusiveOperation(response, async () => {
        const { status, preflight } = await collectStatusAndPreflight(gameDirectory, stateDirectory);
        sendJson(response, 200, { ok: true, status, preflight });
      });
      return;
    }

    if (url.pathname === "/api/install") {
      await withExclusiveOperation(response, async () => {
        const config = validateSettings(body.settings);
        mkdirSync(stateDirectory, { recursive: true });
        const configPath = join(stateDirectory, `.fast-cesto-ui-config-${randomUUID()}.json`);
        try {
          writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
          const result = await runCli(["install", gameDirectory, configPath, stateDirectory]);
          const { status, preflight } = await collectStatusAndPreflight(gameDirectory, stateDirectory);
          sendJson(response, 200, { ok: true, result, status, preflight });
        } finally {
          if (existsSync(configPath)) unlinkSync(configPath);
        }
      });
      return;
    }

    if (url.pathname === "/api/restore") {
      await withExclusiveOperation(response, async () => {
        const result = await runCli(["restore", gameDirectory, stateDirectory]);
        const { status, preflight } = await collectStatusAndPreflight(gameDirectory, stateDirectory);
        sendJson(response, 200, { ok: true, result, status, preflight });
      });
      return;
    }

    if (url.pathname === "/api/diagnostic") {
      await withExclusiveOperation(response, async () => {
        const startedAt = Date.now();
        const { status, preflight } = await collectStatusAndPreflight(gameDirectory, stateDirectory);
        const report = createDiagnosticReport({ status, stateDirectory, preflight });
        recordOperation(stateDirectory, {
          command: "diagnose",
          outcome: "success",
          result: "diagnostic-downloaded",
          durationMs: Date.now() - startedAt,
          gameVersion: status.gameVersion,
          currentSha256: status.currentSha256,
          configuration: status.activeConfig,
          recovery: status.recovery,
        });
        const filename = `fast-cesto-diagnostic-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        const serialized = `${JSON.stringify(report, null, 2)}\n`;
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${basename(filename)}"`,
          "Content-Length": Buffer.byteLength(serialized),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        response.end(serialized);
      });
      return;
    }

    sendJson(response, 404, { ok: false, error: "Not found" });
  } catch (error) {
    const statusCode = /required|Unsupported|must be|too large|valid JSON/.test(error.message)
      ? 400
      : 500;
    sendJson(response, statusCode, { ok: false, error: error.message });
  }
});

server.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

server.listen(Number.isInteger(requestedPort) && requestedPort >= 0 ? requestedPort : 0, "127.0.0.1", () => {
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
  console.log(JSON.stringify({ result: "ui-ready", url: origin, port: address.port }));
  if (!noOpen && process.platform === "win32") {
    execFile("rundll32.exe", ["url.dll,FileProtocolHandler", origin], { windowsHide: true }, () => {});
  }
});
