[CmdletBinding()]
param(
  [switch]$SkipTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not available. Run .\scripts\windows\prepare.ps1 first."
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Step "Checking Windows host"
if ($env:OS -ne "Windows_NT") {
  throw "This script must be run on Windows."
}

Write-Step "Checking required commands"
Require-Command "node"
Require-Command "npm"
Require-Command "rustup"
Require-Command "rustc"
Require-Command "cargo"

Write-Step "Configuring Rust MSVC target"
& rustup default stable-msvc
& rustup target add x86_64-pc-windows-msvc

Write-Step "Installing npm dependencies"
& npm install

if (-not $SkipTests) {
  Write-Step "Running frontend tests"
  & npm test

  Write-Step "Running frontend production build"
  & npm run build

  Write-Step "Running Rust tests"
  & cargo test --manifest-path src-tauri/Cargo.toml

  Write-Step "Checking Rust formatting"
  & cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
} else {
  Write-Step "Skipping tests and running frontend production build only"
  & npm run build
}

Write-Step "Building Windows NSIS installer"
& npm run tauri:build:windows

$installerDirs = @(
  (Join-Path $repoRoot "src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis"),
  (Join-Path $repoRoot "src-tauri\target\release\bundle\nsis")
)

$installers = @()
foreach ($dir in $installerDirs) {
  if (Test-Path $dir) {
    $installers += Get-ChildItem -Path $dir -Filter "*.exe" -File
  }
}

if ($installers.Count -eq 0) {
  throw "NSIS installer was not found under src-tauri\target\...\bundle\nsis."
}

Write-Step "Build artifacts"
foreach ($installer in $installers | Sort-Object LastWriteTime -Descending) {
  $hash = Get-FileHash -Algorithm SHA256 $installer.FullName
  Write-Host $installer.FullName -ForegroundColor Green
  Write-Host "SHA256: $($hash.Hash.ToLowerInvariant())"
}

Write-Host ""
Write-Host "Windows installer build completed." -ForegroundColor Green
