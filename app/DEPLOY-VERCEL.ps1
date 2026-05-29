#Requires -Version 5.1
# Evokaa Tickets - Deploy Vercel

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $scriptPath

Write-Host "========================================"
Write-Host "  AURA TICKETS - DEPLOY VERCEL"
Write-Host "========================================"
Write-Host ""

# Encontrar npm
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    $paths = @(
        "C:\Program Files\nodejs\npm.cmd",
        "C:\Program Files (x86)\nodejs\npm.cmd",
        "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { $npm = $p; break }
    }
}
if (-not $npm) {
    Write-Host "ERROR: npm not found. Install Node.js from https://nodejs.org"
    Read-Host "Press Enter to exit"
    exit 1
}

# Install dependencies (inclui vercel agora)
Write-Host "[1/3] Installing dependencies..."
& $npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Install failed!"
    Read-Host "Press Enter to exit"
    exit 1
}

# Build
Write-Host ""
Write-Host "[2/3] Building..."
& $npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!"
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "Build OK!" -ForegroundColor Green

# Deploy via npm run deploy
Write-Host ""
Write-Host "[3/3] Deploying to Vercel..."
Write-Host "Answer the Vercel CLI questions below:"
Write-Host ""
& $npm run deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "URL: https://aura-platform-fodcshzgh-scoprics-projects.vercel.app" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
