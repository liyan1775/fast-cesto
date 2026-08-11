# Fast Cesto v0.1.0-alpha.1

Fast Cesto is an unofficial QoL patcher for the exact Epic Games Store Windows `1.01.3` build of **Sol Cesto**.

> Public Alpha: back up your save before testing. This is not a stable release.

## Use

1. Install Node.js 20 or newer.
2. Back up your Sol Cesto save; the Epic version has no cloud saves.
3. Fully close Sol Cesto.
4. Double-click `start-fast-cesto.cmd`.
5. Confirm the game folder, review all compatibility checks, choose a preset, and apply it.
6. Launch Sol Cesto normally through Epic Games Launcher.

To uninstall, close the game, start Fast Cesto, and choose **Restore original**.

Read `ALPHA-TESTING.md` before testing and report results through the GitHub Alpha-test Issue form:
https://github.com/liyan1775/fast-cesto/issues/new?template=alpha-test.yml

## Features

- Base speed: `1× / 1.25× / 1.5× / 2×`
- Optional hold-to-activate Turbo using left or right Shift
- Optional removal of the repeated movement camera zoom
- Future permanent-gold income: `1× / 2× / 3×`
- Verified backup, interrupted-operation recovery, and exact original restore
- Ten compatibility checks and privacy-filtered diagnostics

The local UI listens only on `127.0.0.1`. Fast Cesto does not connect to the internet, upload files, or read game saves. It builds the mod locally from the user's own hash-matched `www/assets.dat`. This ZIP contains no game archive, EXE, DLL, Epic SDK, credential, or save.

## Limits

- Epic Games Store Windows `1.01.3` only; Steam and unknown hashes are rejected.
- Node.js 20+ is currently required.
- Turbo pause/scene transitions and special/death gold paths need more gameplay coverage.
- Inspect diagnostic JSON before uploading it, even though fields are allowlisted.

Unofficial. Not affiliated with or endorsed by the developers or publishers. Requires a legally owned copy of Sol Cesto.

---

## 简体中文

Fast Cesto 是只支持 Epic Games Store Windows `1.01.3` 精确构建的非官方《Sol Cesto》QoL 补丁器。这是公开 Alpha，请先备份存档。

使用步骤：安装 Node.js 20+；自行备份存档；完全关闭游戏；双击 `start-fast-cesto.cmd`；查看全部兼容性检查并应用配置；然后从 Epic 正常启动。卸载时关闭游戏并选择“恢复原版”。

功能包括基础速度、Shift Turbo、关闭行动 Zoom、未来永久金币倍率、自动备份/中断恢复/精确还原，以及脱敏诊断。工具不联网、不上传文件、不读取存档，也不在 ZIP 中包含任何游戏归档、EXE、DLL、Epic SDK、凭据或存档。

请先阅读 `ALPHA-TESTING.md`，再通过上述 GitHub Issue 表单反馈。不要上传游戏文件、存档、Epic 配置、用户名或完整路径。
