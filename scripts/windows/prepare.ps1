[CmdletBinding()]
param(
  [switch]$InstallMissing,
  [switch]$SkipNpmInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Add-Failure {
  param(
    [System.Collections.Generic.List[string]]$Failures,
    [string]$Message
  )
  $Failures.Add($Message) | Out-Null
  Write-Host "Missing: $Message" -ForegroundColor Yellow
}

function Install-WingetPackage {
  param(
    [string]$Id,
    [string]$Name,
    [string[]]$ExtraArgs = @()
  )

  if (-not $InstallMissing) {
    return
  }

  if (-not (Test-Command "winget")) {
    throw "winget is not available. Install $Name manually, then rerun this script."
  }

  Write-Step "Installing $Name with winget"
  & winget install --id $Id --exact --source winget --accept-package-agreements --accept-source-agreements @ExtraArgs
}

function Get-VsWherePath {
  $candidate = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $candidate) {
    return $candidate
  }
  return $null
}

function Test-MsvcBuildTools {
  $vswhere = Get-VsWherePath
  if (-not $vswhere) {
    return $false
  }

  $installationPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  return [bool]$installationPath
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Step "Checking Windows host"
if ($env:OS -ne "Windows_NT") {
  throw "This script must be run on Windows."
}

$failures = [System.Collections.Generic.List[string]]::new()

Write-Step "Checking command line tools"

if (-not (Test-Command "git")) {
  Install-WingetPackage "Git.Git" "Git"
  if (-not (Test-Command "git")) {
    Add-Failure $failures "Git. Install with: winget install --id Git.Git --exact"
  }
}

if (-not (Test-Command "node")) {
  Install-WingetPackage "OpenJS.NodeJS.LTS" "Node.js LTS"
  if (-not (Test-Command "node")) {
    Add-Failure $failures "Node.js LTS. Install with: winget install --id OpenJS.NodeJS.LTS --exact"
  }
}

if (-not (Test-Command "npm")) {
  Add-Failure $failures "npm. Reopen PowerShell after installing Node.js."
}

if (-not (Test-Command "rustup")) {
  Install-WingetPackage "Rustlang.Rustup" "Rustup"
  if (-not (Test-Command "rustup")) {
    Add-Failure $failures "Rustup. Install with: winget install --id Rustlang.Rustup --exact"
  }
}

if (-not (Test-MsvcBuildTools)) {
  Install-WingetPackage `
    "Microsoft.VisualStudio.2022.BuildTools" `
    "Microsoft C++ Build Tools" `
    @("--override", "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended")

  if (-not (Test-MsvcBuildTools)) {
    Add-Failure $failures "Microsoft C++ Build Tools with Desktop development C++ workload."
  }
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Preparation is incomplete:" -ForegroundColor Red
  $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
  Write-Host ""
  Write-Host "After installing missing tools, reopen PowerShell and rerun this script."
  exit 1
}

Write-Step "Configuring Rust MSVC target"
& rustup default stable-msvc
& rustup target add x86_64-pc-windows-msvc

if (-not $SkipNpmInstall) {
  Write-Step "Installing npm dependencies"
  & npm install
}

Write-Step "Environment summary"
& node -v
& npm -v
& rustc --version
& cargo --version
& rustup show

Write-Host ""
Write-Host "Windows build environment is ready." -ForegroundColor Green
Write-Host "Next: powershell -ExecutionPolicy Bypass -File .\scripts\windows\build-installer.ps1"
