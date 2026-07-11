# Windows Build Scripts

These scripts prepare a Windows x86-64 environment and build the Chrona NSIS installer.

## Fresh Windows Quick Start

Open PowerShell. If Git is not installed yet, install it first:

```powershell
winget install --id Git.Git --exact
```

Clone the packaging branch:

```powershell
git clone -b release/phase-14-cross-platform-packaging https://github.com/mingyu1715/Chrona.git
cd Chrona
```

Prepare the build environment:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\prepare.ps1 -InstallMissing
```

If the script installs Node.js, Rust, or Visual Studio Build Tools, close and reopen PowerShell, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\prepare.ps1
```

Build the installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build-installer.ps1
```

Expected output:

```text
src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\*.exe
```

## Fast Build Without Tests

Use this only after a full verified build has already passed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build-installer.ps1 -SkipTests
```

## Source ZIP Instead of Git

If Git is not available, download and extract the branch ZIP:

```powershell
Invoke-WebRequest `
  -Uri "https://github.com/mingyu1715/Chrona/archive/refs/heads/release/phase-14-cross-platform-packaging.zip" `
  -OutFile "Chrona.zip"
Expand-Archive .\Chrona.zip -DestinationPath .
Set-Location (Get-ChildItem -Directory -Filter "Chrona-*" | Select-Object -First 1).FullName
```

Then run the same `prepare.ps1` and `build-installer.ps1` commands.

## Notes

- Run on a real Windows x86-64 machine.
- Chrona builds a NSIS installer, not MSI.
- The installer is unsigned, so Windows SmartScreen may warn.
- WebView2 uses Tauri's `downloadBootstrapper` mode.
