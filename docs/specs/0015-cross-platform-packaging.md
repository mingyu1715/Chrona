# 0015. Cross-Platform Packaging

## Status

Active for Phase 14.

## Goal

Define the packaging targets for Chrona MVP without changing the backup, snapshot, restore, comparison, integrity, or repository-management behavior.

## Supported Phase 14 Targets

macOS:

- Architecture: Apple Silicon only
- Rust target: `aarch64-apple-darwin`
- Bundle targets: `.app`, `.dmg`
- Signing: none
- Notarization: none

Windows:

- Architecture: x86-64 only
- Rust target: `x86_64-pc-windows-msvc`
- Bundle target: NSIS `setup.exe`
- WebView2 mode: `downloadBootstrapper`
- Signing: none

## Out of Scope

- macOS Intel
- macOS universal binary
- Windows `.msi`
- Linux packages
- mobile builds
- automatic updates
- release automation
- signing certificates

## Tauri Configuration

Common app metadata lives in:

```text
src-tauri/tauri.conf.json
```

macOS packaging overrides live in:

```text
src-tauri/tauri.macos.conf.json
```

macOS installer packaging overrides live in:

```text
src-tauri/tauri.macos.installer.conf.json
```

Windows packaging overrides live in:

```text
src-tauri/tauri.windows.conf.json
```

The platform-specific files are intentionally small. They only select package targets and platform-specific installer behavior.

Both platform-specific configs must set `bundle.active` to `true`. Without this, Tauri can compile the release binary without producing the requested installer or app bundle.

## Data Location Policy

Chrona must continue to use Tauri's app local data directory for local app state:

```text
app_local_data_dir()/repository-registry.json
app_local_data_dir()/Repositories/
```

Repository metadata relative paths remain `/` normalized and must not depend on the host OS separator.

## Validation Rule

macOS packaging can be validated on an Apple Silicon Mac. Windows packaging must be validated on a real Windows x86-64 environment; macOS cannot be used as proof that the Windows installer works.
