import { SUPPORTED } from "./build-prototype.mjs";
import { tmpdir } from "node:os";
import { classifyInstallState, ensureFreeSpace, validateConfig } from "./fast-cesto.mjs";

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const config = validateConfig({
  schemaVersion: 2,
  gameVersion: "1.01.3",
  speed: 1.5,
  disableMovementZoom: true,
  goldMultiplier: 2,
  turbo: {
    enabled: false,
    key: "ShiftLeft",
    multiplier: 2,
  },
});
requireEqual(config.speed, 1.5, "valid config speed");

for (const invalidConfig of [
  { ...config, speed: 1.75 },
  { ...config, goldMultiplier: 4 },
  { ...config, disableMovementZoom: "true" },
  { ...config, turbo: { ...config.turbo, key: "KeyT" } },
  { ...config, turbo: { ...config.turbo, multiplier: 4 } },
  { ...config, extra: true },
]) {
  let rejected = false;
  try {
    validateConfig(invalidConfig);
  } catch {
    rejected = true;
  }
  requireEqual(rejected, true, "invalid config rejected");
}

const installedHash = "A".repeat(64);
const state = {
  originalAssetsSha256: SUPPORTED.assetsSha256,
  installedAssetsSha256: installedHash,
};
requireEqual(
  classifyInstallState(SUPPORTED.assetsSha256, null),
  "original",
  "original state",
);
requireEqual(
  classifyInstallState(installedHash, state),
  "installed",
  "known installed state",
);
requireEqual(
  classifyInstallState("B".repeat(64), state),
  "unknown",
  "unknown archive state",
);

let insufficientSpaceRejected = false;
try {
  ensureFreeSpace(tmpdir(), Number.MAX_SAFE_INTEGER, "Test artifact");
} catch (error) {
  insufficientSpaceRejected = error?.code === "ENOSPC";
}
requireEqual(insufficientSpaceRejected, true, "insufficient free space rejected");

console.log(JSON.stringify({ result: "passed" }, null, 2));
