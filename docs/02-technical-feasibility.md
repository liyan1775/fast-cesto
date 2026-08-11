# 技术可行性与待验证项

## 1. 已知技术背景（实机已确认）

- 《Sol Cesto》由 Construct 3 制作；
- 旧 Steam 版本曾采用 NW.js，社区 ModKit 直接处理 `package.nw`；
- 当前 Epic `1.01.3` 使用 Construct 3 Windows WebView2 导出，与旧 ModKit 的封装不同；
- 新版金币编辑器提到 EBWebView 数据结构，进一步支持 Epic/新版已迁移到 WebView2 的判断；
- 内容位于 `www/assets.dat`，已完成归档解析、无损重打包、脚本定位和实机 A/B。

Construct 3 Windows Wrapper 可能把项目文件放在可见的 `www` 目录、`assets.dat` 自定义归档中，或嵌入单个 EXE。官方说明见：[Windows wrapper options](https://www.construct.net/en/make-games/manuals/construct-3/interface/dialogs/windows-wrapper-options)。

## 2. 功能可行性

### 动画/整体节奏倍率

Construct 3 Runtime 提供 `runtime.timeScale`，理论上可以改变使用 dt、计时器、Tween 等游戏逻辑的整体速度。官方接口：[IRuntime](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/iruntime)。

预期难点：

- 游戏可能同时使用受 time scale 影响和不受其影响的计时方式；
- 音频、粒子、UI Tween 与逻辑事件不一定同步；
- 过高倍率可能跳过输入窗口或暴露竞态；
- 如果直接提高全局 time scale，概率本身通常不应变化，但随机调用次序需要回归验证。

当前判断：**固定 1.5× 已实机可行；内部 Alpha 已支持启动前配置 1×/1.25×/1.5×/2×，不在首版提供 3×/4×。**

### 关闭行动 Zoom

Construct 3 的 Layout 接口公开了缩放属性，理论上可通过固定 `runtime.layout.scale`、阻止特定 Tween，或改写触发镜头动画的事件实现。官方接口：[ILayout](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/layout-interfaces/ilayout)。

预期难点：

- 需要区分“行动时重复 Zoom”和有叙事意义的 Boss/过场镜头；
- 单纯锁定 layout scale 可能误伤菜单、适配或场景切换；
- 最理想方案是只拦截对应行动事件，而不是禁用所有镜头变化。

当前判断：**已定位 `camera_zoomCase` 的唯一目标 Tween 并通过 A/B；可只关闭行动 Zoom。**

### 按住 Turbo

如果全局速度设置可稳定工作，Turbo 只是对按键按下/松开时切换倍率，风险低于自动清场。

当前判断：**预览已实现并通过真实玩法触发。** 运行时位于 Construct Worker，因此补丁接入 Runtime 自身的 `keydown`、`keyup`、`window-blur`、`keyboard-blur` 和 `suspend` 分发器，而不是监听 DOM `window`。当前左 Shift、2× 临时乘数已通过用户实玩；自动测试覆盖按下/松开、窗口失焦复位和错误按键不触发，基础 time scale 为 0 时乘法结果仍为 0。暂停和场景切换仍需回归；公开默认保持关闭，本机预览显式开启。

### 永久金币倍率

已确认 `metaProgression` 的变量 0 是当前永久金币，变量 2 是累计获得量。Epic 1.01.3 中共有 20 个明确属于“本局金币结算或直接存入”的写入动作：

- 6 组正常过渡/特殊离场结算，当前余额和累计值各一项；
- 3 组死亡保留结算，当前余额和累计值各一项；
- 2 项直接存入/出售所得。

整数倍率通过在每个目标动作后追加等价写入实现：2× 追加一次，3× 追加两次。这样不需要猜测 Construct 表达式字节码，也不会修改局内金币、价格或扣款逻辑。

明确排除：

- 本地存档读取与已有余额；
- 局外购买扣款；
- 官方一次性金币 Offer；
- 剧情/特殊固定赠送；
- 生命、概率、解锁和其他资源。

构建器会校验 20 个原始 action SID、对象、变量索引和奖励表达式；任何目标变化都中止构建。内部 Alpha 已支持 1×/2×/3× 严格配置和跨配置重建；当前 2× 安装已通过结构验证、启动冒烟和一次用户正常永久金币结算，实际余额增加 `2×`。死亡、特殊离场和直接存入/出售路径仍待分支回归。

### Auto Clear / Fast Finish

它不是单纯视觉功能，需要判断：

- 是否仍存在不同选择；
- 道具、被动、诅咒、隐藏事件是否会让选择产生不同结果；
- 自动执行是否改变随机数消耗顺序；
- 清场奖励、成就和秘密条件是否保持一致。

当前判断：**功能上可能可做，但测试成本和改变结果的风险明显更高，移出 v1.0。**

## 3. 可能的接入路径

按优先级排序：

### A. 可见 Web 项目文件

如果安装目录存在普通 `www`、JavaScript、JSON 和资源文件：

- 可定位运行时初始化和游戏事件；
- 通过小型、可读补丁实现功能；
- 易于生成差异、测试和恢复；
- 最适合公开发布。

结论：**Go。**

### B. `assets.dat` 可提取与重打包

如果使用 Construct 3 自定义归档：

- 需要确认归档格式、完整性检查和回写方式；
- 应只分发补丁器，不分发完整解包内容；
- 必须对目标归档做哈希保护和原始备份。

结论：**Conditional Go。**

### C. 项目资源嵌入单个 EXE

- 可能需要分析 WebView2 打包器的资源段或临时解包行为；
- 维护和安全软件误报风险增大；
- 每次游戏更新更容易失效。

结论：**Conditional Go，需重新评估投入。**

### D. 运行时注入或通用 Loader

- 可能需要 DLL 注入、调试端口、进程 Hook 或任意 JavaScript 执行能力；
- 安全、发布审核和用户信任成本最高；
- 通用 Loader 会扩大攻击面，不符合首版目标。

结论：**最后手段；默认 No-Go。**

## 4. 实机确认结果

1. 已确认 WebView2 与 `www/assets.dat`；
2. 已记录 EXE、归档和内部补丁目标的 SHA-256；
3. JavaScript 可读取，`data.json` 可解析，归档 1010 个条目均未压缩；
4. 原版零修改重打包可以做到整个归档字节级一致；
5. 游戏不阻止已知哈希原型启动，安装/恢复可安全往返；
6. 本地 WebView2 profile 已创建，但不复制或公开，避免泄露账号相关数据；
7. Epic Overlay、成就、云存档和完整 Run 仍属于用户回归项；
8. 完整证据和指纹见 [07-epic-1.01.3-technical-findings.md](07-epic-1.01.3-technical-findings.md)。

## 5. 技术原型进度

```text
只读文件勘察（完成）
→ 生成原版指纹（完成）
→ 在工作副本中定位脚本（完成）
→ 验证固定 1.5× timeScale（完成冒烟测试）
→ 验证只关闭行动 Zoom（完成 A/B）
→ 安装与恢复原版（完成）
→ 永久金币 2× 精确路径原型（完成静态验证、启动冒烟与一次正常结算实测）
→ 配置化本地补丁器、跨配置重建与未知哈希拒绝（完成）
→ Turbo Worker 预览、失焦复位与真实玩法触发（完成；暂停/切场景待验收）
→ 事务日志、启动恢复、并发锁、游戏运行与空间预检（完成）
→ 金币其他分支、完整 Run、存档、奖励、音频与 Epic 回归（待用户）
→ 普通用户本地 UI、脱敏日志/诊断和封闭 Alpha 封装（完成）
→ 跨机器封闭 Alpha 与独立运行时封装（待验证/决策）
```

不应先做漂亮安装器，再证明底层补丁是否稳定。

## 6. 发布导向的技术约束

- 补丁器必须对未知版本 fail closed；
- 不需要管理员权限时不得申请管理员权限；
- 不联网，不内置自动更新；
- 日志只写本地，不包含用户名、Epic 账号或完整个人路径；
- 不复制、上传或提交正版游戏文件到仓库；
- 测试样本如必须保存，只保存哈希、结构元数据和最小不可还原片段；
- 补丁操作必须具备事务性：失败时不留下半修改状态；
- 恢复后应校验文件哈希与修改前一致。
