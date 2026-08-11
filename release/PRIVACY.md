# Privacy and data boundary / 隐私与数据边界

Fast Cesto is an offline local tool:

- It makes no network request and contains no telemetry, advertising, or automatic update code.
- It does not read, copy, or upload Epic account configuration.
- It does not read or modify game saves.
- It does not collect the Windows username or full file paths.
- Operation logs contain only time, command, outcome, duration, supported version/hash data, and configuration enum values.
- Diagnostic reports add operating-system, architecture, and Node.js version data using an explicit field allowlist.

Game and backup directories are used only on the local computer for an operation the user explicitly requests. They are shown in the local UI but omitted from diagnostic logs. Inspect a report before uploading it.

Fast Cesto 是离线本地工具：不发起网络请求，不含遥测、广告或自动更新；不读取或修改存档；不读取、复制或上传 Epic 账号配置；不收集 Windows 用户名和完整路径。日志与诊断采用字段白名单，游戏和备份目录只用于用户明确选择的本地操作。上传诊断前仍请自行检查。
