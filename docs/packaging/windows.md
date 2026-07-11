# Windows Packaging

## Target

- Platform: Windows x86-64
- Rust target: `x86_64-pc-windows-msvc`
- Bundle: NSIS `setup.exe`
- WebView2: `downloadBootstrapper`
- Signing: not configured

## Required Environment

- Node.js and npm
- Rust stable MSVC toolchain
- Microsoft C++ Build Tools
- Tauri prerequisites for Windows
- Internet access during install when WebView2 runtime is missing

## Preflight

```powershell
node -v
npm -v
rustc --version
cargo --version
rustup show
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

## Build

```powershell
npm run tauri:build:windows
```

Expected artifact:

```text
src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\Chrona_0.1.0_x64-setup.exe
```

The exact file name must be recorded after a real Windows build.

## Manual Checks

- Launch installer.
- Confirm WebView2 bootstrapper behavior on a machine without a current WebView2 runtime.
- Launch installed app.
- Create or register a repository.
- Confirm registry persistence after restart.
- Run a small backup.
- Reveal repository/source paths in File Explorer.
- Check 100%, 125%, and 150% display scaling.
- Uninstall Chrona.
- Record any SmartScreen or unsigned-installer warning.
