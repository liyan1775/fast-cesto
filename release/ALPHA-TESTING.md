# Fast Cesto public Alpha test protocol

Thank you for testing. This release supports only the exact Epic Games Store Windows `1.01.4b` build. Never force it onto Steam, the previous `1.01.3` build, or an unknown hash.

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

## D. Focus preview

1. Enable left-Ctrl Focus `0.5×` and keep base `1.5×` plus left-Shift Turbo `2×`.
2. Press and release Focus in a normal room; speed should drop temporarily to `0.5×` and return.
3. Hold Turbo and then Focus; Focus must win. Release Focus while still holding Turbo; speed must return to Turbo.
4. Optional: if a fourth-area bomb enemy or wall/hand trap appears naturally, note input and audio feel. Do not deliberately wait for death; the effective deadline clock chain is already covered by the exact-build automated audit.
5. Cover pause, room/scene transition, Alt+Tab, and focus loss. The game must never remain stuck slow.
6. Note Ctrl conflicts, input loss, or unusual audio behavior.

## E. Report

Close the game, download a privacy-filtered diagnostic report, inspect it, and use the GitHub **Alpha test report** Issue form. Restore the original if you do not plan to keep testing.

Stop immediately for save/game-file damage, failed restoration, unexplained progress rollback, unsafe transaction state, or a credible security alert.

---

## 简体中文摘要

只在 Epic Windows `1.01.4b` 精确构建上测试。先核对 ZIP 哈希、解压、安装 Node.js 20+、单独备份存档并关闭游戏。依次完成“应用配置 → Epic 启动 → 恢复原版 → 再次启动”，再覆盖基础 `1.5×`、行动 Zoom、正常/特殊金币、Shift Turbo、Ctrl Focus、两键重叠、暂停、切场景和 Alt+Tab。第四区域危险的有效判定时钟已由精确构建自动审计确认；若正常游玩时自然遇到炸弹怪或手墙陷阱，只需反馈按键和音频手感，不必故意等到死亡。出现写入/恢复失败、存档或游戏文件异常时立即停止。

使用 GitHub Alpha 测试 Issue 表单反馈；不要上传游戏文件、存档、Epic 配置、用户名或完整路径，诊断 JSON 发送前也请自行检查。
