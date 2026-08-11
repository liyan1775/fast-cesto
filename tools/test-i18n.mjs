import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SUPPORTED_LANGUAGES,
  chooseInitialLanguage,
  normalizeLanguage,
  translate,
  translatePreflightCheck,
  translations,
} from "../ui/i18n.js";

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "ui", "index.html"), "utf8");
const app = readFileSync(join(root, "ui", "app.js"), "utf8");
const referenceKeys = Object.keys(translations.en).sort();

for (const language of SUPPORTED_LANGUAGES) {
  requireEqual(
    JSON.stringify(Object.keys(translations[language]).sort()),
    JSON.stringify(referenceKeys),
    `${language} translation key parity`,
  );
  for (const key of referenceKeys) {
    requireEqual(typeof translations[language][key], "string", `${language}:${key} string`);
    requireEqual(translations[language][key].length > 0, true, `${language}:${key} non-empty`);
  }
}

const markupKeys = [...html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)].map((match) => match[1]);
for (const key of markupKeys) {
  requireEqual(referenceKeys.includes(key), true, `markup translation key ${key}`);
}

for (const requiredText of ["English", "简体中文", 'id="languageSelect"']) {
  requireEqual(html.includes(requiredText), true, `language control ${requiredText}`);
}
requireEqual(app.includes("localStorage.setItem(LANGUAGE_STORAGE_KEY"), true, "language preference persistence");
requireEqual(normalizeLanguage("en-US"), "en", "English locale normalization");
requireEqual(normalizeLanguage("zh-TW"), "zh-CN", "Chinese locale normalization");
requireEqual(normalizeLanguage("fr-FR"), null, "unsupported locale normalization");
requireEqual(chooseInitialLanguage("zh-CN", ["en-US"]), "zh-CN", "stored preference wins");
requireEqual(chooseInitialLanguage(null, ["zh-CN", "en-US"]), "zh-CN", "browser Chinese default");
requireEqual(chooseInitialLanguage(null, ["fr-FR"]), "en", "unsupported browser fallback");
requireEqual(translate("en", "preflight.blocking", { count: 3 }), "3 blocking", "English interpolation");
requireEqual(translate("zh-CN", "preflight.blocking", { count: 3 }), "3 项阻止", "Chinese interpolation");

const preflightFixtures = [
  { id: "NODE_RUNTIME", status: "pass", detectedMajor: 20, minimumMajor: 20 },
  { id: "GAME_LAYOUT", status: "pass" },
  { id: "SUPPORTED_ARCHIVE", status: "pass", state: "installed" },
  { id: "ORIGINAL_BACKUP", status: "warn", valid: false, willCreateOnInstall: true },
  { id: "GAME_PROCESS", status: "pass", running: false },
  { id: "GAME_DIRECTORY_WRITE", status: "pass", writable: true },
  { id: "GAME_DIRECTORY_SPACE", status: "pass", availableBytes: 2, requiredBytes: 1 },
  { id: "STATE_DIRECTORY_WRITE", status: "pass", writable: true },
  { id: "STATE_DIRECTORY_SPACE", status: "pass", availableBytes: 2, requiredBytes: 1 },
  { id: "TEMP_DIRECTORY_SPACE", status: "pass", availableBytes: 2, requiredBytes: 1 },
];
for (const language of SUPPORTED_LANGUAGES) {
  for (const check of preflightFixtures) {
    const localized = translatePreflightCheck(language, check, "20.0.0");
    requireEqual(localized.summary.length > 0, true, `${language}:${check.id} summary`);
    requireEqual(localized.detail.length > 0, true, `${language}:${check.id} detail`);
    requireEqual(localized.summary.startsWith("preflight."), false, `${language}:${check.id} resolved summary`);
  }
}

console.log(JSON.stringify({
  result: "passed",
  languages: SUPPORTED_LANGUAGES,
  translationKeyCount: referenceKeys.length,
  markupKeyCount: markupKeys.length,
}, null, 2));
