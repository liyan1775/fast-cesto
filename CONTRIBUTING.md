# Contributing

Bug reports and focused pull requests are welcome during the Alpha.

## Before reporting

- Confirm the game is the Epic Games Store Windows `1.01.3` build.
- Read `release/KNOWN-ISSUES.md`.
- Use the Alpha or bug Issue form.
- Do not upload `assets.dat`, game EXE/DLL files, saves, Epic configuration, usernames, or full local paths.
- Inspect any diagnostic JSON before attaching it.

## Source changes

- Keep the patcher single-purpose and fail closed on unknown hashes or state.
- Do not add telemetry, automatic uploads, DRM bypasses, arbitrary script execution, or game assets.
- Preserve verified backup and restoration behavior.
- Add or update tests for behavioral changes.
- Keep user-facing release inputs in the explicit allowlist in `tools/build-release.mjs`.

Run the game-independent test set listed in `README.md`. Tests that depend on a legally installed game must remain local and must not commit their inputs or outputs.
