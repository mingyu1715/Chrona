# macOS Packaging

## Target

- Platform: macOS Apple Silicon
- Rust target: `aarch64-apple-darwin`
- Bundles: `.app`, `.dmg`
- Signing: not configured
- Notarization: not configured

## Preflight

```bash
node -v
npm -v
rustc --version
cargo --version
rustup show
xcode-select -p
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

## Build

Build the app bundle:

```bash
npm run tauri:build:macos
```

Build the DMG installer:

```bash
npm run tauri:build:macos:installer
```

Expected artifact:

```text
src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Chrona.app
src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Chrona_0.1.0_aarch64.dmg
```

## Latest Local Result

2026-07-12:

- `npm test`: 21 files, 73 tests passed.
- `npm run build`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: passed.
- `npm run tauri:build:macos`: generated `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Chrona.app`.
- `npm run tauri:build:macos:installer`: generated `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Chrona_0.1.0_aarch64.dmg`.
- App size: about `14M`.
- DMG size: about `7.4M`.
- App executable: arm64 Mach-O.
- `.app` launch was confirmed by the running `Contents/MacOS/chrona` process.
- `hdiutil verify` reported the DMG checksum as valid.
- `hdiutil imageinfo` reported a UDZO compressed image with Software License Agreement enabled.

Observed warning:

- Tauri warns that `com.chrona.app` ends with `.app`. The identifier is kept for Phase 14 because it is the current project identifier.

## Manual Checks

- Launch the `.app`.
- Open the `.dmg` and drag Chrona to Applications.
- Confirm app name and icon in Finder and Dock.
- Create or open a repository.
- Confirm registry persistence after restart.
- Run a small backup.
- Reveal a repository or source path in Finder.
- Record any unsigned app warning.
