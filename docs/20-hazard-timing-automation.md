# 第四区域危险计时自动验证

> 结论：不需要为了验证 Focus，反复从头打到第四区域并故意让角色死亡。Epic 客户端 `1.01.4b`（归档内部项目版本 `1.01.4`）的两条目标判定链均已由原版归档的事件图和 Construct 3 运行时时钟实现闭环验证。

## 1. 自动验证覆盖什么

运行：

```powershell
node tools\test-hazard-timing.mjs
```

测试只读取正版备份 `backups/epic-1.01.4b/assets.dat`，不会改游戏、存档或备份。它首先要求归档 SHA-256 精确等于已支持的 Epic `1.01.4b`，然后验证固定对象、事件 SID、计时器、Tween 完成事件和死亡动作仍然相连。游戏更新或事件结构变化会让测试失败，而不是沿用旧结论。

## 2. 炸弹怪

- 内部事件组：`PIONS - Speciaux - bombe temps`；
- 总窗口变量：`TempsExplosion = 20` 游戏秒；
- 倒计时由 Construct `Timer` behavior 推进；
- `Timer.Tick()` 累加 `runtime.GetDt(instance)`；
- 全局 `timeScale` 会进入这个 `dt`，所以倒计时不是独立墙钟。

理论墙钟窗口：

| 状态 | 墙钟窗口 |
|---|---:|
| 原版 `1×` | 约 20 秒 |
| 当前基础 `1.5×` | 约 13.33 秒 |
| Focus `0.5×` | 约 40 秒 |

## 3. 用户所说的“手陷阱”

与“计时到最大后角色直接死亡”完全对应的内部事件组是 `pieges - murs`。它由 `pion_murs` 和成对的 `pion_murs_murs` 构成：

1. `tempsDispo = 4.5` 游戏秒；
2. 左右两侧分别启动时长为 `tempsDispo` 的 Construct Tween；
3. `OnTweensFinished` 触发 `murKill`；
4. `murKill` 将角色生命变量直接设为 `0`。

Tween 使用 Construct Timeline；新建 Timeline 默认启用 system time scale，逐帧推进量由运行时的 `dt × timeScale` 计算。该事件组内所有 `System.Wait` 也都明确选择游戏时间，没有墙钟 Wait，也没有对象级 time scale 覆盖。

理论墙钟窗口：

| 状态 | 墙钟窗口 |
|---|---:|
| 原版 `1×` | 约 4.5 秒 |
| 当前基础 `1.5×` | 约 3 秒 |
| Focus `0.5×` | 约 9 秒 |

因此 Focus 相对原版提供 `2×` 反应时间；相对当前 `1.5×` 基础速度提供 `3×` 反应时间。

## 4. 自动化能替代什么

可以替代：

- 反复抵达第四区域；
- 通过等死判断判定窗口是否读取墙钟；
- 为同一个客观时钟结论消耗多个 Run；
- 每次改动后人工重新追踪事件链。

仍不能替代：

- Ctrl 按住、松开在真实输入中的主观手感；
- 音频在 `0.5×` 下是否违和；
- Alt+Tab、暂停、切场景后是否让玩家感觉困惑；
- 其他 Windows、安装路径和安全软件环境。

第四区域实机验证因此降为“遇到时顺手确认一次”，不再要求为了测试而故意触发死亡。公开 Focus Preview 仍可邀请用户确认体验，但不需要把“危险判定是否真的变慢”作为尚无证据的猜测。
