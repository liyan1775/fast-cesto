# 发布、合规与维护计划

> 2026-08-11 状态：Epic `1.01.3` 配置化本地补丁器、本地 UI、脱敏诊断和 `v0.1.0-alpha.1` 已完成，决定通过公开 GitHub Alpha 招募网络测试者；尚未经过跨机验证，不达到公开 Beta 门槛。完整 `assets.dat` 仅为本地测试产物，任何发布均不得包含游戏资源。

## 1. 发布定位

建议名称：

> **Fast Cesto — Unofficial QoL Mod for the Epic Games Store version**

首版定位：

- 非官方；
- 免费、开源；
- 仅支持经过验证的 Windows Epic 版本；
- 不绕过 DRM；
- 不重新分发游戏文件；
- 不联网、无遥测、无广告；
- 金币倍率默认 1×，仅在用户明确选择时修改后续永久金币收入；
- 不修改生命、概率、已有余额或解锁；
- 可以完整恢复原版。

项目公开名称确定为 Fast Cesto；所有页面只把 Sol Cesto 名称用于兼容性描述，并附非官方、无隶属和正版前提声明。

## 2. 发布阶段

### 阶段 0：内部技术预览

- 不上传公开二进制；
- 在正版 Epic 安装和工作副本上完成验证；
- 确定补丁格式、支持版本哈希和恢复流程；
- 通过本机 Alpha 门槛。

建议版本：`v0.0.1-dev`。

当前进度：严格配置、本地重打包、自动备份、同配置幂等、跨配置重建、未知哈希拒绝、精确恢复、启动事务恢复、本地 UI、脱敏日志/诊断和 Release 白名单封装已完成；Turbo Worker 预览已通过自动事件测试和用户真实玩法触发，正常永久金币结算已确认 `2×`。本机显式安装 `1.5× + 关闭行动 Zoom + 永久金币 2× + 左 Shift Turbo 2×`。暂停/切场景、金币死亡/特殊分支、用户完整 Run 和跨机器验证尚未完成。

### 阶段 1：公开招募型 Alpha

- 通过公开 GitHub Pre-release 提供；
- 使用公开 Alpha 招募 Issue 收集 3–5 台拥有 Epic 正版的独立环境；
- 清楚标注仅用于测试，要求先备份存档；
- 不在 GameBanana/Nexus 建公开占位页面。

建议版本：`v0.1.0-alpha.1`。

当前已生成候选 ZIP；它不含游戏资源，提供本地浏览器 UI、10 项安装前预检、命令行核心、脱敏诊断、统一测试协议和 GitHub 结构化反馈表单。首轮仍要求 Node.js 20+，独立运行时封装后置到跨机反馈稳定之后。

### 阶段 2：公开 Beta

- GitHub 作为唯一权威下载源；
- 在 Reddit/官方 Discord 发布一次招募说明；
- 收集兼容性、恢复和安全软件反馈；
- 至少观察 7–14 天。

建议版本：`v0.1.0-beta.1`。

### 阶段 3：稳定版

- 发布 GitHub Stable Release；
- 将 Release 设为不可变并附校验信息；
- 在 GameBanana 创建正式 Mod 页面；
- 发布简短演示视频或 GIF、安装与恢复教程；
- Reddit/Discord 各发布一次正式通知。

建议版本：`v1.0.0`。

### 阶段 4：平台和功能扩张

- Steam 支持作为独立兼容目标，不与 Epic 共用未经验证的包；
- Nexus 在稳定成品和支持能力具备后再申请游戏页面；
- Auto Clear 使用实验分支或独立功能开关；
- 更广泛的 Progression Tuner、Save & Quit 等不自动进入路线图；永久金币倍率已经纳入首版。

## 3. 发布渠道

### GitHub：权威源

用途：

- 源代码与开发历史；
- Tagged Releases 和二进制；
- Issue、版本兼容表和更新说明；
- 下载统计；
- SHA-256、SBOM/构建来源证明；
- 安全问题报告。

GitHub Release 可以绑定 Git 标签、提供二进制和 Release Notes，并通过 API查看下载量：[About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)。公开仓库还可以为构建产物生成来源证明：[Artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)。

### GameBanana：主要发现渠道

Sol Cesto 已经存在专门的 [GameBanana Hub](https://gamebanana.com/games/22677)，目前公开内容稀少，适合稳定版进入。

发布前需要处理：

- 可执行文件的文件分析和潜在误报；
- 版权、署名和禁止恶意软件规则；
- AI Generated Content Policy 对 AI 辅助代码的适用范围；
- 是否需要管理员人工审核。

规则来源：[GameBanana Rules](https://gamebanana.com/rules/1000)、[AI Generated Content Policy](https://gamebanana.com/wikis/2175)。

由于政策主要详细讨论生成资产、数据集和软件，对人主导的 AI 辅助代码未给出足够清晰的单独分类，上传前应向管理员确认。项目页主动披露 AI 辅助，避免使用 AI 生成宣传图。

### Reddit 与官方 Discord：社区触达

- Alpha：只发布一次测试者招募；
- Stable：发布一次正式说明；
- 展示真实的原版/Mod 对比；
- 不夸大性能或兼容性；
- 不重复顶帖、不私信群发。

### Nexus：后置渠道

如果 Nexus 尚未收录游戏，可以随成品 Mod 请求新增游戏；官方只批准已经可下载使用、符合提交规则的成品，而不是公开占位页：[How can I add a new game?](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)。

Nexus 现行规则还要求：

- AI 辅助代码正确标记；
- 能用版本历史和开发证据证明人类主导；
- 功能声明有技术证据；
- 可执行程序不得进行非必要联网，自动更新不属于必要联网；
- 上传内容不得包含未经许可的版权文件。

来源：[File Submission Guidelines](https://help.nexusmods.com/article/28-file-submission-guidelines)。

### Steam 社区：Steam 版验证后再进入

Epic 版发布时不应在标题中声称 Steam 兼容。只有获得 Steam 构建并由 Steam 用户独立测试后，才发布对应文件和社区说明。社区发帖需遵守 [Steam 讨论与用户内容规则](https://help.steampowered.com/en/faqs/view/6862-8119-C23E-EA7B)。

## 4. Release 包内容

建议稳定版资产：

```text
FastCesto-Epic-v1.0.0.zip
FastCesto-Epic-v1.0.0.sha256
FastCesto-Epic-v1.0.0-sbom.spdx.json   # 条件允许时
```

ZIP 内：

```text
FastCesto.exe                         # 或勘察后确定的最小启动方式
README.txt
LICENSE.txt
THIRD-PARTY-NOTICES.txt
supported-builds.json
CHANGELOG.md
```

不包含：

- 完整游戏 EXE、`assets.dat`、`main.js` 或其他正版资源；
- Epic SDK、认证令牌或用户存档；
- 自动更新器、下载器和遥测组件；
- 通用脚本执行引擎；
- 未使用的运行时和大体积依赖。

## 5. 信任与安全设计

- 仓库公开，CI 从标签构建 Release；
- Release 提供 SHA-256 和构建来源证明；
- 可执行程序不联网，可由用户或平台静态检查；
- 未签名阶段明确说明 Windows SmartScreen 可能警告；
- 不教用户关闭安全软件；
- 如出现误报，提交厂商复核并保留证据；
- 有足够用户后再评估购买代码签名证书；
- 提供 `SECURITY.md` 和私下报告安全问题的方式；
- 不提供强制绕过版本检查的 GUI 按钮。

## 6. 版权、品牌与开发者沟通

目前没有找到《Sol Cesto》明确公开的 Mod 政策。公开发布前应联系开发者或发行商，保存书面回复。

建议询问：

1. 是否接受免费、开源、本地运行的 QoL Mod；
2. 是否允许在 GitHub、GameBanana、Reddit 和 Discord 发布；
3. 是否可以用游戏名称说明兼容性；
4. 是否可以使用实际游戏截图或官方 Press Kit 素材；
5. 对成就、自动清场和商业赞助是否有特别要求。

英文联系草案：

```text
Hi,

I'm developing a free, open-source, unofficial QoL mod for the Windows
Epic Games Store version of Sol Cesto. Its initial scope is limited to
animation speed controls and disabling the repeated movement camera zoom.

The mod will not bypass DRM, redistribute game files, edit existing saves,
collect data, connect to the internet, or include monetization. Its optional
gold multiplier only affects future earned currency and defaults to 1x. It
will verify supported game builds and provide automatic backup and restoration.

Would you be comfortable with a public release? May I use the Sol Cesto
name solely to describe compatibility, and use my own gameplay screenshots
or assets from the official press kit on the project page?

Thank you.
```

官方页面和 Press Kit：[Sol Cesto — Goblinz Studio](https://goblinzstudio.com/game/sol-cesto/)。

所有公开页面应包含：

```text
Unofficial. Not affiliated with or endorsed by the developers or publishers.
Requires a legally owned copy of Sol Cesto.
```

## 7. AI 辅助披露

建议统一表述：

```text
This project is human-directed and human-tested. OpenAI Codex was used as
a coding and research assistant. The complete source, commit history, build
workflow, tests, and known limitations are public.
```

需要做到：

- 人类确定产品范围和最终发布决定；
- 所有生成代码经过理解、审查和测试；
- 保留真实提交历史，不把整个项目压成一次提交；
- 不使用无法解释的生成代码；
- 不使用来源未知的 AI 生成美术、音频或游戏资产；
- 按各平台要求选择 `AI Assisted` 或等价标签。

## 8. 版本与维护策略

使用语义版本：

- Patch：错误修复、不改变功能语义；
- Minor：新增可选 QoL 功能或新游戏构建支持；
- Major：补丁机制或兼容范围发生破坏性变化。

兼容状态：

- `Supported`：当前哈希已测试；
- `Testing`：发现新游戏版本，正在验证；
- `Unsupported`：已知不兼容；
- `Unknown`：未识别，工具必须拒绝修改。

游戏更新流程：

```text
发现新哈希
→ 当前版本自动拒绝
→ 获取正版更新并生成差异
→ 重跑自动化和核心 Run
→ 发布新的 supported-builds.json/补丁版本
```

不承诺即时跟随每次游戏更新。首版维护范围建议写为“best effort，优先支持当前 Epic Windows 正式版”。

## 9. 宣传与变现

首发宣传材料：

- 20–30 秒原版/Mod 并排对比；
- 一张设置界面截图；
- 四步安装与恢复说明；
- 明确列出支持的商店和游戏哈希；
- 已知问题和安全说明。

文档语言优先英文和简体中文，法语等语言后续接受社区贡献。

首发免费、开源、无捐赠宣传。只有在开发者态度明确、项目稳定且确实存在持续用户后，再单独评估 GitHub Sponsors/Ko-fi；不在 Steam 讨论中推广商业或捐赠内容。
