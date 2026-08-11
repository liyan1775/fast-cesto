# Fast Cesto public Alpha test protocol

Thank you for testing. This release supports only the exact Epic Games Store Windows `1.01.3` build. Never force it onto Steam or an unknown hash.

## Before testing

1. Verify the ZIP SHA-256 against the GitHub Release page.
2. Extract it to a normal folder; do not run inside the ZIP.
3. Install Node.js 20 or newer.
4. Back up your save separately because the Epic version has no cloud saves.
5. Fully close Sol Cesto before starting `start-fast-cesto.cmd`.

Do not post full paths, usernames, Epic information, saves, or game files. Inspect diagnostic JSON before sending it.

## A. Install and restore round trip

1. Confirm all ten compatibility checks have no red blocking item.
2. Apply base `1.5×`, movement zoom off, future gold `2×`, Turbo off.
3. Launch through Epic and enter the title screen and one normal room.
4. Exit, restore the original, and launch through Epic again.
5. Reapply the configuration for feature testing.

Stop after any write/restore failure. Download diagnostics and report the failure without running Epic verification over the evidence.

## B. Base QoL

1. Play at least 15–30 minutes or through a boss boundary.
2. Check input, animation, audio, and freeze-frame behavior at base `1.5×`.
3. Confirm movement zoom is gone while story/menu camera behavior remains normal.
4. Record one normal permanent-gold balance before and after settlement.
5. If encountered, record death, special-exit, direct-deposit, or sale gold behavior.
6. Check Epic overlay and achievements where possible.

## C. Turbo boundaries

1. Enable left-Shift Turbo `2×` on base `1.5×`.
2. Press and release it in a normal room; speed should rise temporarily to `3×` and return.
3. Cover pause, room/scene transition, and Alt+Tab.
4. Trigger focus loss while holding Turbo; returning must not leave Turbo stuck.
5. Note input loss, overlapping audio, skipped rewards, or settlement anomalies.

## D. Report

Close the game, download a privacy-filtered diagnostic report, inspect it, and use the GitHub **Alpha test report** Issue form. Restore the original if you do not plan to keep testing.

Stop immediately for save/game-file damage, failed restoration, unexplained progress rollback, unsafe transaction state, or a credible security alert.

---

## 简体中文摘要

只在 Epic Windows `1.01.3` 精确构建上测试。先核对 ZIP 哈希、解压、安装 Node.js 20+、单独备份存档并关闭游戏。依次完成“应用配置 → Epic 启动 → 恢复原版 → 再次启动”，再覆盖基础 `1.5×`、行动 Zoom、正常/特殊金币、Shift Turbo 按下松开、暂停、切场景和 Alt+Tab。出现写入/恢复失败、存档或游戏文件异常时立即停止。

使用 GitHub Alpha 测试 Issue 表单反馈；不要上传游戏文件、存档、Epic 配置、用户名或完整路径，诊断 JSON 发送前也请自行检查。
