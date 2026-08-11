# 需求、竞品与真实空白

## 1. 调研结论

《Sol Cesto》存在一个真实但规模偏长尾的 QoL Mod 空白，最明确的需求是：

- 调整动画或整体节奏速度；
- 关闭行动时反复触发的镜头 Zoom；
- 减少已经没有决策价值时的重复清场操作。
- 缓解无云存档、换电脑或从头开始时的局外金币重复刷取。

社区已有金币修改器和面向旧 Steam/NW.js 版本的 ModKit。金币工具验证了数值恢复需求，实际从头游玩的体验又验证了温和倍率需求；但没有发现一个支持当前 Epic/WebView2 版本、同时解决“速度 + Zoom + 进度节奏”的完整 QoL 工具。

因此，项目不是进入一个完全没有竞争的广义修改市场，而是在以下细分位置填空：

> **当前 Epic 版 + 节奏与镜头 QoL + 可选进度调节 + 安全可恢复的安装体验。**

## 2. 外部需求证据

### 动画速度

玩家将缺少动画速度选项与无法保存、缺少手柄支持一起列为主要 QoL 问题。另有专门讨论提出希望加快游戏速度。

- [Steam：Speed up the game](https://steamcommunity.com/app/2738490/discussions/0/796715232585238248/)

### 关闭 Zoom

玩家明确表示行动时的镜头缩放令人不适或伤眼；后续回复还把关闭 Zoom、加快动画和清场等待放在同一需求中。

- [Steam：Turn off zoom?](https://steamcommunity.com/app/2738490/discussions/0/796715232585124396/)

### 自动清场

社区有人单独提出 Auto Clear Button。这个需求真实，但它涉及判断“当前是否仍有有效决策”，错误实现可能改变游戏结果，因此不进入首版稳定功能。

- [Steam：Auto Clear Button](https://steamcommunity.com/app/2738490/discussions/0/570416261335573970/)

### Mod 内容供给不足

Epic 赠送后，Reddit 仍有人直接询问是否存在玩家制作的内容 Mod；回复普遍认为游戏很小众、现有内容很少，并期待新增玩家带来 Mod 生态。

- [Reddit：Are there any Sol Cesto mods?](https://www.reddit.com/r/SolCesto/comments/1vgcpcl/are_there_any_sol_cesto_mods_like_fan_made_mods/)
- [GameBanana：Sol Cesto Hub](https://gamebanana.com/games/22677)

### 金币与无云存档场景

已有 GoldPatcher/GoldEditor 说明玩家确实会寻找金币恢复工具。当前用户在新电脑上没有可用云存档，只能从头开始，进一步证明“温和的永久金币 2×”既是刷取减负，也是设备迁移后的实际恢复需求。

## 3. 已存在的相邻工具

### Sol-Cesto-GoldPatcher

- 目标是修改金币/存档，而不是运行时 QoL；
- 证明社区愿意使用专门的小工具；
- 旧版本失效也证明游戏更新兼容是实际维护问题。

项目地址：[gdpinheiro/Sol-Cesto-GoldPatcher](https://github.com/gdpinheiro/Sol-Cesto-GoldPatcher)

### SolCesto-GoldEditor

- 面向较新的 EBWebView 存档结构；
- 仍属于数值/存档编辑器；
- 与速度、Zoom 和动画控制没有直接重叠。

项目地址：[JuanCBayona/SolCesto-GoldEditor](https://github.com/JuanCBayona/SolCesto-GoldEditor)

### sol-cesto-modkit

- 面向旧 Steam v100.2/NW.js `package.nw` 结构；
- 可以作为历史研究材料；
- 不能假设可以直接用于当前 Epic/WebView2 版本。

项目地址：[RyanCraighead/sol-cesto-modkit](https://github.com/RyanCraighead/sol-cesto-modkit)

### Trainer/数值修改类工具

搜索结果中存在声称可修改大量数值的 Trainer 或聚合站页面，但这类工具的真实性、安全性和版本兼容尚未独立验证，也不解决本项目的核心 QoL 问题。它们说明“作弊修改”并非空白，反而强化了本项目不应定位成 Trainer。

## 4. 需求优先级

| 功能 | 需求证据 | 技术风险 | 结果风险 | 当前决策 |
|---|---:|---:|---:|---|
| 动画/节奏倍率 | 高 | 中低 | 低 | MVP |
| 关闭行动 Zoom | 高 | 中低 | 低 | MVP |
| 按住 Turbo | 中 | 低 | 低 | MVP 候选 |
| Screen Shake 开关 | 中低 | 低至中 | 低 | v1.x 候选 |
| 快速重复过场 | 中 | 中 | 低至中 | v1.x 候选 |
| Auto Clear | 中高 | 中高 | 高 | 实验版/后续 |
| 永久金币倍率 | 中高 | 中 | 中 | MVP，公开默认 1×、推荐 2× |
| 一次性设置金币 | 已验证 | 中 | 高 | v1.x 恢复工具，默认隐藏 |
| Save & Quit | 高 | 高 | 高 | 暂不做，且可能被官方实现 |
| 手柄支持 | 高 | 中高 | 中 | 暂不做，官方替代风险高 |
| 内容/角色/无限模式 | 中 | 很高 | 很高 | 不属于首个项目 |

## 5. MVP 产品定义

### 目标用户

- 喜欢原版策略和美术，但觉得重复动画过慢的玩家；
- 对反复镜头缩放不适的玩家；
- Epic 新增玩家和重复游玩的老玩家；
- 不想使用无限金币或 God Mode、但希望减少重复刷取的玩家；
- 没有云存档、换电脑后需要温和恢复进度的正版玩家。

### 核心承诺

> 我们不替玩家做决策；默认保持原版经济，按玩家明确选择减少等待与重复刷取。

### 首版界面草案

```text
Fast Cesto

Game speed
  1.00×  1.25×  1.50×  2.00×

Hold to turbo
  Enabled / Disabled

Action camera zoom
  Vanilla / Disabled

Permanent gold gain
  1× (Vanilla) / 2× (Recommended) / 3×

Progress recovery
  Advanced / One-time / Back up before change

Restore original game
```

实际是做游戏内设置、外部配置窗口还是启动器选项，要等安装结构勘察后决定。

## 6. 成功与失败判据

### 产品成功

- 两项核心功能确实解决玩家描述的问题；
- 原版决策和概率不变；金币倍率关闭时奖励不变，开启时只有列明的永久金币收入按倍率改变；
- 普通玩家无需手工改文件即可安装和恢复；
- 游戏更新后工具能够安全拒绝未知版本，而不是继续盲目修改。

### 项目 No-Go

出现以下情况之一，需要暂停或缩小范围：

- 当前 Epic 包完全不可安全提取或回写；
- 只能依赖高权限、通用代码注入或不可解释的二进制修改；
- 无法做到可靠备份与恢复；
- 加速必然破坏游戏逻辑、随机序列或保存行为；
- 开发者明确反对公开发布此类 Mod。
