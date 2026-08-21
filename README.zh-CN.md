# Fast Cesto

[English](README.md) · [下载公开 Alpha](https://github.com/liyan1775/fast-cesto/releases/tag/v0.2.0-alpha.1) · [提交 Alpha 测试报告](https://github.com/liyan1775/fast-cesto/issues/new?template=alpha-test.yml)

Fast Cesto 是面向 Windows Epic Games Store 版《Sol Cesto》的免费、开源、非官方 QoL Mod，用于减少重复等待与镜头不适，并始终保留恢复原版的路径。

> [!WARNING]
> 这是公开 Alpha，不是稳定版。目前只支持 Epic Windows `1.01.4b` 的精确构建（归档内部项目版本为 `1.01.4`）。测试前请自行备份存档。

## 功能

- 基础速度：`1× / 1.25× / 1.5× / 2×`
- 可选左/右 Shift 按住临时加速（Turbo）
- 可选左/右 Ctrl 按住临时减速（Focus），目标速度 `0.5× / 0.75× / 1×`
- 可选关闭行动时反复出现的镜头 Zoom
- 未来永久金币收入：`1× / 2× / 3×`
- 精确版本/哈希检查、自动原版备份、事务中断恢复和一键还原
- 离线本地 UI 与脱敏诊断报告
- English / 简体中文界面，可手动切换并记住选择

公开默认配置较保守：基础 `1.5×`、关闭行动 Zoom、金币 `1×`、Turbo/Focus 关闭；推荐配置使用未来金币 `2×`。工具不改现有金币、购买扣款、剧情奖励、存档、DRM 或概率规则。

## 要求与安装

- Windows Epic Games Store 正版《Sol Cesto》
- 游戏版本 `1.01.4b`，且原始归档哈希与受支持构建完全一致
- [Node.js 20 或更高版本](https://nodejs.org/)

安装步骤：

1. 先自行备份《Sol Cesto》存档；Epic 版没有云存档。
2. 从最新 GitHub Release 下载 `fast-cesto-v0.2.0-alpha.1.zip`，并核对页面上的 SHA-256。
3. 解压到普通目录，不要直接在 ZIP 内运行。
4. 完全关闭游戏，双击 `start-fast-cesto.cmd`。
5. 查看十项兼容性预检，选择配置并应用。
6. 从 Epic Games Launcher 正常启动游戏。

卸载时关闭游戏，再次启动 Fast Cesto，选择“恢复原版”。工具只使用从你自己的正版安装生成并验证的备份。

## 公开招募测试者

目前特别需要覆盖 Windows 10/11、默认/自定义安装路径、非 ASCII 路径、不同 DPI 和不同安全软件的 Epic `1.01.4b` 玩家。请按 [Alpha 测试协议](release/ALPHA-TESTING.md)操作，并使用 [结构化 Issue 表单](https://github.com/liyan1775/fast-cesto/issues/new?template=alpha-test.yml)反馈。

请勿上传游戏文件、存档、Epic 配置、用户名或完整本机路径。诊断报告已经脱敏，但发送前仍应自行打开检查。

## 安全边界

Fast Cesto 不重新分发游戏资源、不绕过 DRM、不联网、不含遥测，也不读写存档。发布包通过白名单生成，自动拒绝游戏 EXE/DLL、`assets.dat`、运行状态、日志、凭据与开发者绝对路径。

更多内容见 [隐私说明](release/PRIVACY.md)、[已知问题](release/KNOWN-ISSUES.md)、[安全政策](SECURITY.md)与 [`docs/`](docs/) 中的技术记录。

Fast Cesto 的原创源码与文档使用 [MIT License](LICENSE)。《Sol Cesto》及其资源归相应权利人所有，不属于本许可证范围。

非官方项目，与《Sol Cesto》的开发者或发行商无隶属、授权或背书关系；使用时必须持有正版游戏。

本项目由人类决定方向并进行实机测试；OpenAI Codex 被用于辅助编程与调研。
