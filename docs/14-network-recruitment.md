# 网络招募与发布顺序

> 当前选择：公开 GitHub Alpha 作为唯一权威下载源。外部玩家测试达到门槛前，不称 Public Beta 或 Stable。

## 第一层：GitHub（立即）

- 公开源码、MIT 许可证和游戏资源排除声明；
- `v0.1.0-alpha.1` 标记为 Pre-release；
- Release 附 ZIP SHA-256、已验证范围和待测矩阵；
- 建立公开“Alpha testers wanted”Issue；
- 使用结构化 Alpha 报告与 Bug 表单；安全问题走私密漏洞报告。

GitHub 页面本身可以通过网络分享和收集结果，但自然发现量有限，不能保证仅靠仓库获得 3–5 名合格测试者。

## 第二层：已有玩家社区（账号具备后）

优先级：

1. `r/SolCesto`：已有玩家主动询问是否存在 Mod，需求匹配度最高；
2. Steam Community 的 Sol Cesto General Discussions：主题和玩家量更大，但帖子必须醒目标注当前只支持 Epic `1.01.3`；
3. GameBanana 的 Sol Cesto 游戏 Hub：跨机结果稳定后建立正式 Mod 页面，不先上传未经验证的 Beta/Stable；
4. Nexus Mods：稳定版和持续维护能力明确后再考虑。

论坛帖子只链接 GitHub Release，不重复上传不同 ZIP，避免版本和哈希分叉。账号注册、版规确认和最终发帖需要账号持有人完成或明确授权已登录会话。

## 英文招募短帖

```text
[Public Alpha] Fast Cesto — QoL mod for Sol Cesto (Epic Windows 1.01.3)

I have released the first public Alpha of Fast Cesto, a free and open-source,
unofficial QoL mod for the Epic Games Store Windows version of Sol Cesto.

It adds configurable game speed, optional hold-Shift Turbo, an option to remove
the repeated movement camera zoom, and an optional multiplier for future
permanent-gold income. It verifies the exact supported build, creates a backup,
can restore the original, works offline, and does not redistribute game files.

This Alpha supports only the exact Epic Windows 1.01.3 build. Steam is not
supported. Please back up your save first. I am looking for Windows 10/11 testers,
especially custom/non-ASCII paths, different DPI/security software, longer runs,
special gold paths, and Turbo pause/scene/Alt+Tab behavior.

Source, download, SHA-256, known issues, and structured test form:
https://github.com/liyan1775/fast-cesto
```

## 中文招募短帖

```text
【公开 Alpha】Fast Cesto — Epic Windows 1.01.3《Sol Cesto》QoL Mod

Fast Cesto 首个公开 Alpha 已发布。它提供基础加速、可选 Shift Turbo、关闭行动
Zoom，以及可选的未来永久金币倍率；会严格检查游戏版本，自动备份并支持恢复原版，
全程离线，也不重新分发游戏文件。

目前只支持 Epic Windows 1.01.3 精确构建，不支持 Steam。测试前请先备份存档。
现招募 Windows 10/11、自定义或非 ASCII 路径、不同 DPI/安全软件的测试者，
并重点收集较完整 Run、特殊金币结算和 Turbo 暂停/切场景/Alt+Tab 结果。

源码、下载、SHA-256、已知问题和反馈表单：
https://github.com/liyan1775/fast-cesto
```
