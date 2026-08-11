# Fast Cesto

[简体中文](README.zh-CN.md) · [Download the public Alpha](https://github.com/liyan1775/fast-cesto/releases/tag/v0.1.0-alpha.1) · [Report an Alpha test](https://github.com/liyan1775/fast-cesto/issues/new?template=alpha-test.yml)

Fast Cesto is a free, open-source, unofficial quality-of-life mod for the Windows Epic Games Store version of **Sol Cesto**. It reduces repeated waiting and camera motion while keeping the original game files recoverable.

> [!WARNING]
> This is a public Alpha, not a stable release. It currently supports only the exact Epic Games Store Windows `1.01.3` build. Back up your save before testing.

## Features

- Base game-speed choices: `1×`, `1.25×`, `1.5×`, or `2×`
- Optional hold-to-activate Turbo using left or right Shift
- Optional removal of the repeated camera zoom during movement
- Future permanent-gold income multiplier: `1×`, `2×`, or `3×`
- Exact build/hash checks, automatic original-file backup, transactional recovery, and one-click restore
- Offline local UI and privacy-filtered diagnostic reports

The public default is conservative: `1.5×` speed, movement zoom disabled, gold at `1×`, and Turbo disabled. The recommended preset uses `2×` future gold. Existing balances, purchases, story rewards, saves, DRM, and probability rules are not modified.

## Requirements

- A legally owned Epic Games Store copy of Sol Cesto for Windows
- Game version `1.01.3` with the exact supported archive hash
- [Node.js 20 or newer](https://nodejs.org/)

Steam and unknown game builds are intentionally rejected instead of being modified.

## Install and restore

1. Back up your Sol Cesto save. The game does not provide cloud saves on Epic.
2. Download `fast-cesto-v0.1.0-alpha.1.zip` from the latest GitHub Release and verify its SHA-256 shown on that page.
3. Extract the ZIP to a normal folder; do not run it inside the archive.
4. Fully close Sol Cesto, then double-click `start-fast-cesto.cmd`.
5. Review the ten compatibility checks, choose a preset, and apply it.
6. Launch the game normally through Epic Games Launcher.

To uninstall, close the game, start Fast Cesto again, and choose **Restore original**. Restoration uses the verified backup created from your own legally installed copy.

## Alpha testers wanted

We especially need Epic `1.01.3` testers covering Windows 10/11, default and custom install paths, non-ASCII paths, different display scaling, and different security software. Please follow [the Alpha protocol](release/ALPHA-TESTING.md) and submit the [structured Alpha report](https://github.com/liyan1775/fast-cesto/issues/new?template=alpha-test.yml).

Do not attach game files, saves, Epic configuration, usernames, or full local paths. The diagnostic report is filtered, but inspect it before uploading.

## Safety and scope

Fast Cesto does not redistribute game assets, bypass DRM, connect to the internet, collect telemetry, or edit save files. The release is generated from an allowlist and rejects game executables, DLLs, `assets.dat`, runtime state, logs, credentials, and developer paths.

See [Privacy](release/PRIVACY.md), [Known issues](release/KNOWN-ISSUES.md), [Security policy](SECURITY.md), and the Chinese technical notes in [`docs/`](docs/).

## Development

The repository includes the patcher source, local UI, tests, release builder, and research notes. The distributed ZIP contains only the end-user allowlist; it never contains the original or modified full game archive.

Safe tests that do not require game files:

```powershell
node tools/test-fast-cesto.mjs
node tools/test-diagnostics.mjs
node tools/test-preflight.mjs
node tools/test-transaction-recovery.mjs
node tools/test-ui-server.mjs
node tools/build-release.mjs
node tools/test-release-bundle.mjs
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before sending changes.

## License and disclaimer

Fast Cesto's original source code and documentation are licensed under the [MIT License](LICENSE). Sol Cesto and its assets are owned by their respective rights holders and are not covered by this license.

Unofficial. Not affiliated with or endorsed by the developers or publishers of Sol Cesto. Requires a legally owned copy of the game.

This project is human-directed and human-tested. OpenAI Codex was used as a coding and research assistant.
