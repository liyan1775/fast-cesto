# 下载完成后的开工清单

## 1. 当前状态

- 用户已经拥有 Epic Games Store 正版；
- 游戏已下载至当前工作区并完成基线勘察；
- M0–M4a 补丁器核心已完成：封装识别、固定 1.5×、关闭行动 Zoom、金币倍率、Turbo、配置化本地构建、安全安装、中断恢复与原版恢复；
- 当前 Turbo Preview 配置已安装，备份和状态清单有效；用户已确认正常金币 2×、基础加速和真实玩法 Turbo，仍待长流程及边界场景试玩；
- 详细结果见 [07-epic-1.01.3-technical-findings.md](07-epic-1.01.3-technical-findings.md)。

## 2. 第一轮操作完成情况

以下步骤均已执行；保留本节作为可审计的开工记录。

### Step 1：定位正版安装

- 从 Epic 安装记录或实际目录确认路径；
- 不依赖猜测的默认路径；
- 确认游戏下载完整且没有仍在更新；
- 记录磁盘可用空间。

### Step 2：建立只读基线

- 递归生成文件名、大小、修改时间和 SHA-256 manifest；
- 读取主 EXE 元数据和数字签名；
- 搜索封装特征：`www`、`assets.dat`、`package.nw`、WebView2、NW.js 等；
- 检查是否已有用户设置或存档目录；
- 将基线保存到本项目，但不提交版权文件。

产物建议：

```text
research/install-manifest.json
research/executable-metadata.json
research/wrapper-notes.md
```

这些文件如包含个人绝对路径，提交前必须匿名化。

### Step 3：原版冒烟测试

- 启动一次原版；
- 记录启动时间、菜单、当前版本显示和主要进程；
- 完成最短可行的游戏操作；
- 正常退出；
- 再次比较安装目录和存档目录变化。

如用户尚未运行过游戏，是否由用户首次启动，要根据 Epic 登录和交互需求决定；不得擅自使用或索取账号密码。

### Step 4：识别资源和脚本

- 优先分析公开、明文或可合法读取的本地资源；
- 在工作副本中解包或格式研究，不直接试改正版目录；
- 定位 Construct runtime 初始化、layout、Tween、镜头和输入代码；
- 搜索 time scale、zoom、scale、camera、tween 等候选路径；
- 记录代码是否压缩/混淆及可维护性。

### Step 5：给出技术 Go/No-Go 报告

报告至少包含：

- 实际封装方式；
- 最可能的补丁入口；
- 速度功能可行性；
- Zoom 功能可行性；
- 是否能安全恢复；
- 预估原型和发布实现复杂度；
- 推荐 Go / Conditional Go / No-Go；
- 是否需要调整 MVP。

### Step 6：最小原型

只有 Go 后才开始：

1. 在工作副本验证固定 `1.25×`；
2. 验证恢复 `1×`；
3. 定位并只关闭行动 Zoom；
4. 做最短 Run 回归；
5. 再设计配置和补丁器。

## 3. 初始仓库结构建议

技术路径确认后再建立：

```text
src/                 补丁器或运行时代码
tests/               单元与集成测试
patches/             不含游戏原文的最小补丁定义
docs/                产品、技术、测试和发布文档
research/            匿名化结构与哈希研究记录
.github/workflows/   CI、Release 和来源证明
```

建议开源许可证：MIT。正式选择应在确认第三方依赖和补丁表达形式后完成。

## 4. 第一轮问题的答案

- Epic 版是 Construct 3 WebView2；
- 资源在 `www/assets.dat`，不是 `package.nw` 或嵌入单 EXE；
- 旧 ModKit 的需求和 Construct 思路可参考，封装工具不能直接复用；
- 中央 timeScale 入口可以实现固定 1.5×，短程输入与结算正常；
- 行动 Zoom 来自 `camera_zoomCase` 中的特定 Tween；
- 可以只移除该 action，保留 biome、shake 和其他镜头逻辑；
- Epic SDK/成就仍需用户用正常 Epic 启动完成回归；
- 游戏更新后必须按整个 `assets.dat` 精确哈希重新验证；
- 公开包必须使用补丁器/补丁定义，不包含完整游戏归档。

## 5. 停止条件

遇到以下情况先停止并向用户报告：

- 需要关闭或绕过 DRM、Epic 登录或签名校验；
- 需要上传完整游戏文件到第三方服务；
- 需要从用户账号提取、复制或重用凭证；
- 目标文件无法建立可靠备份；
- 修改路径可能损坏唯一存档且无法隔离；
- 必须使用高权限通用注入才能继续；
- 开发者明确禁止相关 Mod。

## 6. 开工后的首个里程碑

首个里程碑不是发布 EXE，而是一份经实机验证的技术报告和最小原型：

```text
M0 — Wrapper Identified
M1 — 1.25× Prototype
M2 — Zoom Prototype
M3 — Safe Patch + Restore
M4 — Internal Alpha
M5 — Closed Alpha
M6 — Public Beta
M7 — Stable v1.0
```

当前已完成 M4 Internal Alpha 的本地 CLI、三项配置、Turbo、事务恢复、本地 UI、脱敏诊断和候选包；正在进入 M5 Closed Alpha，剩余重点是用户边界验收与跨机器验证。开发顺序和测试分工见 [08-prototype-validation-and-next-tests.md](08-prototype-validation-and-next-tests.md)。
