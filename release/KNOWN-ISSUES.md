# Known issues — v0.2.0-alpha.1 / 已知问题

- Only the exact registered Epic Games Store Windows `1.01.4b` hash is supported; the previous `1.01.3` release is intentionally rejected.
- Node.js 20 or newer is required; there is no standalone executable yet.
- Turbo works in real gameplay, but pause and scene-transition behavior needs more independent coverage.
- Focus is a preview feature. The exact-build event/runtime audit confirms that the fourth-area bomb and wall/hand-trap deadlines use scaled game time, but real-encounter input and audio feel still lack independent coverage.
- Focus uses left or right Ctrl; those keys have no known game-event binding in the supported build but still need real-menu and gameplay conflict testing.
- Normal permanent-gold `2×` has been verified once; death, special-exit, direct-deposit, and sale paths remain pending.
- Read-only directory messaging has not been tested across many Windows ACL configurations.
- Windows 10, non-ASCII game paths, high-DPI settings, and third-party security software need independent testing.

简要说明：当前只支持 Epic Windows `1.01.4b` 精确哈希，旧 `1.01.3` 会被明确拒绝，要求 Node.js 20+；精确构建自动审计已确认第四区域炸弹与手墙陷阱的有效判定随游戏时间减速，但真实遭遇时的按键和音频手感、Ctrl 键位仍需实机确认。Turbo/Focus 暂停与切场景、特殊金币分支、Windows 10、非 ASCII 路径、高 DPI、第三方安全软件和更多权限环境仍需外部测试。
