import { SUPPORTED } from "./build-prototype.mjs";
import { tmpdir } from "node:os";
import { classifyInstallState, ensureFreeSpace, validateConfig } from "./fast-cesto.mjs";

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const config = validateConfig({
  schemaVersion: 3,
  gameVersion: "1.01.4b",
  speed: 1.5,
  disableMovementZoom: true,
  goldMultiplier: 2,
  turbo: {
    enabled: false,
    key: "ShiftLeft",
    multiplier: 2,
  },
  focus: {
    enabled: true,
    key: "ControlLeft",
    targetSpeed: 0.5,
  },
});
requireEqual(config.speed, 1.5, "valid config speed");
requireEqual(config.schemaVersion, 3, "valid config schema");
requireEqual(config.focus.targetSpeed, 0.5, "valid Focus target speed");

const migratedConfig = validateConfig({
  schemaVersion: 2,
  gameVersion: "1.01.4b",
  speed: 1.25,
  disableMovementZoom: false,
  goldMultiplier: 1,
  turbo: {
    enabled: false,
    key: "ShiftRight",
    multiplier: 1.5,
  },
});
requireEqual(migratedConfig.schemaVersion, 3, "schema v2 migrates to v3");
requireEqual(migratedConfig.focus.enabled, false, "migrated Focus disabled");
requireEqual(migratedConfig.focus.key, "ControlLeft", "migrated Focus default key");
requireEqual(migratedConfig.focus.targetSpeed, 0.5, "migrated Focus default speed");

for (const invalidConfig of [
  { ...config, speed: 1.75 },
  { ...config, goldMultiplier: 4 },
  { ...config, disableMovementZoom: "true" },
  { ...config, turbo: { ...config.turbo, key: "KeyT" } },
  { ...config, turbo: { ...config.turbo, multiplier: 4 } },
  { ...config, focus: { ...config.focus, key: "ShiftLeft" } },
  { ...config, focus: { ...config.focus, targetSpeed: 0.6 } },
  { ...config, focus: { ...config.focus, extra: true } },
  { ...config, schemaVersion: 4 },
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
