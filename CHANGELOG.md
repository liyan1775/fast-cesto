# Changelog

All notable public changes are recorded here.

## [Unreleased]

## [0.2.0-alpha.1] - 2026-08-21

- Updated exact-build support to the Epic client `1.01.4b` update (internal project version `1.01.4`) while continuing to reject unknown and previous archives.
- Added a read-only build-compatibility audit covering all 16 speed/Turbo/Focus combinations and all 6 Zoom/gold combinations.
- Added optional hold-to-activate Focus using left or right Ctrl with absolute `0.5×`, `0.75×`, or `1×` target speeds.
- Defined Focus as higher priority than Turbo and reset both temporary states on blur, suspend, and load.
- Added automatic schema v2 to v3 configuration migration with Focus disabled for existing users.
- Added bilingual Focus controls, configuration summaries, diagnostics, and a dedicated preview preset.
- Added runtime, migration, overlap, UI, diagnostic, and release-bundle regression coverage.
- Added an exact-build hazard timing audit proving that both the fourth-area bomb timer and wall/hand-trap deadline use scaled game time.

## [0.1.0-alpha.2] - 2026-08-11

- Added a visible English / Simplified Chinese language selector.
- Defaulted to the browser language when no preference has been saved.
- Remembered the selected language across page reloads.
- Localized static controls, live install status, all ten preflight checks, summaries, confirmations, and operation results.
- Added translation-key parity, locale selection, preflight localization, server static-file, and real-browser regression coverage.

## [0.1.0-alpha.1] - 2026-08-11

First public Alpha:

- Added configurable base speed, optional Shift Turbo, movement-zoom removal, and future-gold multipliers.
- Added exact Epic `1.01.3` hash gating, verified backup/restore, transactional recovery, process checks, and disk-space preflight.
- Added a local-only configuration UI, privacy-filtered operation logs, and downloadable diagnostics.
- Added an allowlist release builder that rejects game resources, executable files, runtime state, credentials, logs, and local developer paths.
- Verified base speed, movement zoom removal, normal permanent-gold `2×`, and left-Shift Turbo on one real Epic installation.
- Marked cross-machine, special gold paths, Turbo transition cases, and longer runs as pending Alpha coverage.
