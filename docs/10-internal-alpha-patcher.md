# 内部 Alpha 本地补丁器

> 状态：Epic Windows `1.01.3` 已实现并完成本机配置切换/恢复、诊断和本地 UI 回归；已生成封闭 Alpha 候选包，但不是公开稳定版。

## 1. 已实现范围

`tools/fast-cesto.mjs` 只接受一个精确支持的游戏构建，并从用户自己的正版 `assets.dat` 本地生成新归档。发布源码或补丁器时不需要携带完整游戏文件。

配置项：

| 字段 | 允许值 | 说明 |
|---|---|---|
| `speed` | `1 / 1.25 / 1.5 / 2` | 全局时间倍率，保留暂停/freeze-frame 的零倍率语义 |
| `disableMovementZoom` | `true / false` | 只移除行动镜头 Tween；`false` 保留原版动作 |
| `goldMultiplier` | `1 / 2 / 3` | 只复制未来永久金币收入动作 |
| `turbo.enabled` | `true / false` | 是否启用按住临时加速，默认 `false` |
| `turbo.key` | `ShiftLeft / ShiftRight` | Worker 键盘事件码；Space 因游戏内测试绑定不开放 |
| `turbo.multiplier` | `1.5 / 2 / 3` | 按住时乘在基础 Mod 倍率之上 |

当前配置 schema 为 `2`，必须恰好包含完整字段；未知字段、错误类型、未支持值或错误游戏版本都会被拒绝。安装状态还记录独立的补丁实现版本，避免代码更新后因配置相同而错误跳过重建。

项目提供三份配置：

- `config/fast-cesto.default.json`：公开安全默认，金币 `1×`；
- `config/fast-cesto.recommended.json`：推荐体验，金币 `2×`、Turbo 关闭；
- `config/fast-cesto.turbo-preview.json`：当前本机选择，金币 `2×`、左 Shift、Turbo 乘数 `2×`。

## 2. 使用方式

关闭游戏，在项目根目录执行：

```powershell
# 普通用户：启动本地配置界面
.\start-fast-cesto.cmd
```

界面只监听 `127.0.0.1`，写操作必须携带页面会话令牌并来自同一 Origin；调用 CLI 时使用参数数组而不是 shell。高级用户也可直接执行：

```powershell
# 查看原版/已安装/未知状态
node tools\fast-cesto.mjs status SolCesto backups\epic-1.01.3

# 安装不含 Turbo 的 Recommended 配置
node tools\fast-cesto.mjs install SolCesto config\fast-cesto.recommended.json backups\epic-1.01.3

# 安装当前本机使用的 Turbo Preview
node tools\fast-cesto.mjs install SolCesto config\fast-cesto.turbo-preview.json backups\epic-1.01.3

# 精确恢复正版原档
node tools\fast-cesto.mjs restore SolCesto backups\epic-1.01.3
```

`install` 每次都以验证过的正版备份为输入，不会在旧补丁上叠加修改。同一配置重复执行返回 `already-installed`；变更配置返回 `reconfigured`。

## 3. 安全边界

- 支持版本以外的当前归档：拒绝修改；
- 原版备份缺失：仅允许从哈希匹配的当前正版文件创建；
- 原版备份已变化：拒绝继续；
- 配置或安装状态清单无效：拒绝继续；
- 游戏仍在运行：`install`/`restore` 在改动前拒绝；
- 同一状态目录同时只能执行一个操作；陈旧锁会自动回收；
- 写入前预检归档、备份和临时载荷所需空间；
- 安装时先在同一目录生成并验证 stage，交换前原子写入事务日志，再通过 rename 交换；
- 普通文件错误会立即回滚；进程或系统在交换中断时，下次启动按日志与实际哈希提交完整新状态或回滚完整旧状态；
- 孤立 stage 可安全删除；没有日志的 swap 不做猜测并 fail closed；
- 不读写游戏存档，不扫描 Epic 配置，不联网；
- `SolCesto/`、`backups/`、`build/` 和状态清单都不会进入公开仓库。

逻辑中断已在隔离目录中模拟全部关键 rename 落点；不会为了测试主动切断真实机器电源。实际 235 MB 归档也完成 `Turbo → Recommended → 原版 → Turbo` 往返。磁盘空间不足与游戏运行中占用均已验证会在修改前拒绝；只读目录文案已实现，但尚未单独修改本机 ACL 做破坏性权限测试。

## 4. 本轮验证证据

| 场景 | 结果 |
|---|---|
| Recommended 安装 | 通过；金币数据与已试玩 2× 原型相同，运行时另补基础倍率保存/载入保护 |
| 同配置再次安装 | `already-installed`，不重写 |
| 切换到 `1.25× + 原版 Zoom + 金币 3×` | 通过，Zoom 删除 SID 为 `null`，金币副本 40 |
| 从重配状态恢复原版 | 通过，SHA-256 精确回到正版基线 |
| 恢复后再装 Recommended | 通过 |
| 未知测试文件 | 返回失败，文件哈希前后不变 |
| 配置类型/枚举/多余字段 | 全部拒绝 |
| Turbo 左 Shift 按下/松开 | 状态 `off → on → off` |
| Turbo 按住后窗口失焦 | 自动回到 `off` |
| Turbo 右 Shift（未配置） | 保持 `off` |
| 游戏自身左 Shift绑定 | 未发现；Space 存在测试事件，因此不开放 |
| 完整 C3 状态保存/载入 | 只保存基础 time scale，载入后只应用一次 Mod 层；启动冒烟通过 |
| 用户正常永久金币结算 | 实际余额增加 `2×`，基础 1.5× 仍有效 |
| 用户真实玩法 Turbo | 左 Shift 临时加速有效；暂停/切场景仍待覆盖 |
| 8 种事务中断落点 | 首次安装、重配和恢复均提交或回滚到哈希完整状态 |
| 活跃/陈旧操作锁 | 活跃锁拒绝并发；陈旧锁自动接管并最终清理 |
| 孤立 stage / 无日志 swap | stage 自动清理；swap 保留并拒绝继续 |
| 游戏运行中安装 | 明确拒绝，目标归档哈希不变 |
| 磁盘空间不足 | 构建或复制前返回 `ENOSPC` 友好提示 |
| 完整归档恢复往返 | 235 MB 原版哈希精确恢复，最后重新安装 Turbo Preview |
| 结构化操作日志 | NDJSON 字段白名单、512 KiB 自动轮换；不含路径和错误堆栈 |
| 脱敏诊断导出 | 明确声明不含路径、游戏文件、存档和 Epic 配置；脱敏测试通过 |
| UI API 防护 | Host/Origin/会话令牌、请求大小、配置枚举和单操作限制通过 |
| UI 浏览器回归 | 当前配置载入、确认门槛、幂等应用、配置联动、390px 布局通过 |
| 兼容性预检 | 10 项版本、结构、哈希、备份、进程、权限和空间检查通过 |
| Alpha 候选包 | 20 个白名单文件；ZIP 审计不含游戏资源、状态、日志或凭证模式 |
| ZIP 便携性 | 从含中文和空格的临时路径解压后，独立启动、预检和诊断通过 |

当前安装的 Turbo Preview `assets.dat` SHA-256：

```text
729C05865A08735532984FD40F08FAE5ABD9FAF78FA2C17C61DF2F131AA765B6
```

正版备份 SHA-256：

```text
EAFD1E359A0804D28F174D6ECADB587BF44CC849A74839F06ABDBF4CAB88B5DD
```

## 5. 尚未完成

- Turbo 的暂停/切场景回归和长期手感验收；
- 只读目录 ACL 的隔离环境验证；
- 死亡、特殊离场、直接存入/出售的永久金币分支验收；
- 完整 Run 与跨机器测试。
- 独立运行时封装；当前 Alpha 仍要求 Node.js 20+。

因此当前可以继续本机试玩和功能开发，但不能直接作为公开下载包发布。
