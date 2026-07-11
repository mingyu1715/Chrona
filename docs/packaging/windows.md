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

Official Tauri Windows prerequisites are Microsoft C++ Build Tools and Microsoft Edge WebView2. Tauri also recommends the Rust MSVC toolchain for Windows desktop builds.

## Fresh Windows Quick Start

Open PowerShell. If Git is not installed yet:

```powershell
winget install --id Git.Git --exact
```

Clone the current packaging branch:

```powershell
git clone -b release/phase-14-cross-platform-packaging https://github.com/mingyu1715/Chrona.git
cd Chrona
```

Prepare dependencies:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\prepare.ps1 -InstallMissing
```

If Node.js, Rust, or Visual Studio Build Tools were installed by the script, close and reopen PowerShell, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\prepare.ps1
```

Build and verify the installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build-installer.ps1
```

The build script runs frontend tests, frontend production build, Rust tests, rustfmt check, and then `npm run tauri:build:windows`.

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

The direct build command assumes the environment has already been prepared. For a fresh machine, prefer `scripts/windows/prepare.ps1` and `scripts/windows/build-installer.ps1`.

Expected artifact:

```text
src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\Chrona_0.1.0_x64-setup.exe
```

The exact file name must be recorded after a real Windows build.

## Script Files

```text
scripts/windows/prepare.ps1
scripts/windows/build-installer.ps1
scripts/windows/README.md
```

`prepare.ps1 -InstallMissing` can use `winget` to install Git, Node.js LTS, Rustup, and Visual Studio Build Tools. Some installers update PATH only after PowerShell is reopened.

`build-installer.ps1` prints the final `.exe` path and SHA-256 hash.

## GitHub Actions Build

Windows installer builds can run online in GitHub Actions, so a local Windows machine does not need Visual Studio Build Tools installed.

Workflow:

```text
.github/workflows/build-windows-installer.yml
```

Manual run:

1. Open the GitHub repository.
2. Go to `Actions`.
3. Select `Build Windows Installer`.
4. Click `Run workflow`.
5. Leave `release_tag` empty to produce only a workflow artifact.
6. Set `release_tag` to an existing tag, for example `v0.1.0-windows`, to upload the installer to that release.

The workflow runs:

```text
npm install
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run tauri:build:windows
```

Output:

```text
GitHub Actions artifact: *.exe
Optional GitHub Release asset: *.exe
```

The workflow prints the installer SHA-256 in the job summary.

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
