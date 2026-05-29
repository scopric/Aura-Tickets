# Evokaa Tickets — Deploy Final (PowerShell)
# Execute clicando com botão direito → "Executar com PowerShell"
# Ou abra PowerShell e rode: .\DEPLOY-FINAL.ps1

$ErrorActionPreference = "Stop"

# Detectar pasta do script
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $scriptPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AURA TICKETS — DEPLOY FINAL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pasta: $scriptPath" -ForegroundColor DarkGray
Write-Host ""

# Verificar se npm existe
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Host "❌ ERRO: npm não encontrado!" -ForegroundColor Red
    Write-Host "   Instale o Node.js: https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Verificar se npx existe
$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) {
    Write-Host "❌ ERRO: npx não encontrado!" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "[1/3] Instalando dependências..." -ForegroundColor Green
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""
Write-Host "[2/3] Buildando projeto..." -ForegroundColor Green
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no build. Verifique os erros acima." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""
Write-Host "[3/3] Deploy para Vercel..." -ForegroundColor Green
& npx vercel --prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no deploy." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   ✅ DEPLOY CONCLUÍDO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "URL: https://aura-platform-fodcshzgh-scoprics-projects.vercel.app" -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione Enter para fechar"
