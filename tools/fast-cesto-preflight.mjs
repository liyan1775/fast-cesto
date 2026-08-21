import { constants, accessSync, existsSync, statfsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SAFETY_MARGIN_BYTES = 16 * 1024 * 1024;
const TEMP_PAYLOAD_ESTIMATE_BYTES = 32 * 1024 * 1024;
const MINIMUM_NODE_MAJOR = 20;

function diskAvailableBytes(directory) {
  const stats = statfsSync(directory, { bigint: true });
  return Number(stats.bavail * stats.bsize);
}

function makeCheck(id, status, summary, detail, extra = {}) {
  return { id, status, summary, detail, ...extra };
}

function checkWritable(directory, id, summary) {
  try {
    accessSync(directory, constants.W_OK);
    return makeCheck(id, "pass", summary, "目录可写。", { writable: true });
  } catch {
    return makeCheck(id, "block", summary, "目录不可写，请检查权限。", { writable: false });
  }
}

function checkDisk(directory, requiredBytes, id, summary) {
  try {
    const availableBytes = diskAvailableBytes(directory);
    return makeCheck(
      id,
      availableBytes >= requiredBytes ? "pass" : "block",
      summary,
      availableBytes >= requiredBytes ? "可用空间充足。" : "可用空间不足。",
      { availableBytes, requiredBytes },
    );
  } catch {
    return makeCheck(id, "block", summary, "无法读取磁盘空间。", {
      availableBytes: null,
      requiredBytes,
    });
  }
}

export function createPreflightReport({ gameDirectory, stateDirectory, status }) {
  const targetPath = join(gameDirectory, "www", "assets.dat");
  const executablePath = join(gameDirectory, "SolCesto.exe");
  const targetExists = existsSync(targetPath);
  const executableExists = existsSync(executablePath);
  const targetBytes = targetExists ? statSync(targetPath).size : 0;
  const checks = [];

  const nodeMajor = Number(process.versions.node.split(".", 1)[0]);
  checks.push(makeCheck(
    "NODE_RUNTIME",
    nodeMajor >= MINIMUM_NODE_MAJOR ? "pass" : "block",
    "Node.js 运行环境",
    nodeMajor >= MINIMUM_NODE_MAJOR
      ? `Node.js ${process.versions.node} 满足要求。`
      : `需要 Node.js ${MINIMUM_NODE_MAJOR} 或更新版本。`,
    { detectedMajor: nodeMajor, minimumMajor: MINIMUM_NODE_MAJOR },
  ));

  checks.push(makeCheck(
    "GAME_LAYOUT",
    targetExists && executableExists ? "pass" : "block",
    "游戏目录结构",
    targetExists && executableExists
      ? "已找到游戏程序和 assets.dat。"
      : "目录中缺少 SolCesto.exe 或 www\\assets.dat。",
    { executableExists, assetsArchiveExists: targetExists },
  ));

  const supportedState = ["original", "installed"].includes(status?.state);
  checks.push(makeCheck(
    "SUPPORTED_ARCHIVE",
    supportedState ? "pass" : "block",
    "受支持的游戏构建",
    supportedState
      ? `已识别 Epic ${status.gameVersion ?? "1.01.4b"} ${status.state === "original" ? "原版" : "Mod"}归档。`
      : "当前归档不属于已登记的原版或 Mod。",
    { state: typeof status?.state === "string" ? status.state : "unavailable" },
  ));

  const backupRequired = status?.state === "installed";
  const backupReady = status?.backupValid === true;
  checks.push(makeCheck(
    "ORIGINAL_BACKUP",
    backupRequired && !backupReady ? "block" : backupReady ? "pass" : "warn",
    "原版备份",
    backupReady
      ? "原版备份哈希有效。"
      : backupRequired
        ? "已安装 Mod，但缺少有效原版备份。"
        : "首次安装时将创建并验证原版备份。",
    { valid: backupReady, willCreateOnInstall: !backupRequired && !backupReady },
  ));

  checks.push(makeCheck(
    "GAME_PROCESS",
    status?.gameRunning ? "block" : "pass",
    "游戏进程",
    status?.gameRunning ? "Sol Cesto 正在运行，请先完全关闭游戏。" : "未检测到运行中的游戏。",
    { running: status?.gameRunning === true },
  ));

  if (targetExists) {
    checks.push(checkWritable(dirname(targetPath), "GAME_DIRECTORY_WRITE", "游戏资源目录权限"));
    checks.push(checkDisk(
      dirname(targetPath),
      targetBytes + SAFETY_MARGIN_BYTES,
      "GAME_DIRECTORY_SPACE",
      "游戏磁盘空间",
    ));
  } else {
    checks.push(makeCheck("GAME_DIRECTORY_WRITE", "block", "游戏资源目录权限", "游戏资源目录不存在。", { writable: false }));
    checks.push(makeCheck("GAME_DIRECTORY_SPACE", "block", "游戏磁盘空间", "游戏资源目录不存在。", { availableBytes: null, requiredBytes: null }));
  }

  checks.push(checkWritable(stateDirectory, "STATE_DIRECTORY_WRITE", "备份目录权限"));
  checks.push(checkDisk(
    stateDirectory,
    backupReady ? SAFETY_MARGIN_BYTES : targetBytes + SAFETY_MARGIN_BYTES,
    "STATE_DIRECTORY_SPACE",
    "备份磁盘空间",
  ));
  checks.push(checkDisk(
    tmpdir(),
    TEMP_PAYLOAD_ESTIMATE_BYTES,
    "TEMP_DIRECTORY_SPACE",
    "临时目录空间",
  ));

  const blockingIssueIds = checks.filter((check) => check.status === "block").map((check) => check.id);
  const warningIds = checks.filter((check) => check.status === "warn").map((check) => check.id);
  return {
    schemaVersion: 1,
    readyToInstall: blockingIssueIds.length === 0,
    blockingIssueIds,
    warningIds,
    checks,
  };
}
