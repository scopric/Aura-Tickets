#Requires -Version 5.1
# ============================================
# AURA TICKETS — DEPLOY AUTOMÁTICO
# ============================================
# Execute pelo PowerShell:
#   1. Botão direito em DEPLOY-AURA.ps1 → "Executar com PowerShell"
#   2. Ou abra PowerShell e digite: .\DEPLOY-AURA.ps1
# ============================================

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Evokaa Tickets - Deploy"

function Write-Header($text) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success($text) { Write-Host "✅ $text" -ForegroundColor Green }
function Write-Warning($text) { Write-Host "⚠️  $text" -ForegroundColor Yellow }
function Write-Error($text) { Write-Host "❌ $text" -ForegroundColor Red }

# Detectar pasta do script
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $scriptPath

Write-Header "AURA TICKETS — DEPLOY"
Write-Host "Pasta: $scriptPath" -ForegroundColor DarkGray
Write-Host ""

# ============================================
# 1. ENCONTRAR NPM/NPX
# ============================================
Write-Header "1/5 — Verificando Node.js"

$npmCmd = $null
$npxCmd = $null

# Tentar encontrar npm no PATH
$npmInPath = Get-Command npm -ErrorAction SilentlyContinue
$npxInPath = Get-Command npx -ErrorAction SilentlyContinue

if ($npmInPath -and $npxInPath) {
    $npmCmd = "npm"
    $npxCmd = "npx"
    Write-Success "npm encontrado no PATH"
} else {
    # Procurar em locais comuns
    $caminhosPossiveis = @(
        "C:\Program Files\nodejs",
        "C:\Program Files (x86)\nodejs",
        "$env:APPDATA\npm",
        "$env:LOCALAPPDATA\Programs\nodejs",
        "$env:ProgramFiles\nodejs"
    )
    
    # Tentar encontrar via NVM
    $nvmPath = "$env:APPDATA\nvm"
    if (Test-Path $nvmPath) {
        $versoes = Get-ChildItem $nvmPath -Directory | Sort-Object Name -Descending
        if ($versoes) {
            $caminhosPossiveis += "$nvmPath\$($versoes[0].Name)"
        }
    }
    
    foreach ($p in $caminhosPossiveis) {
        $npmTest = Join-Path $p "npm.cmd"
        $npxTest = Join-Path $p "npx.cmd"
        if ((Test-Path $npmTest) -and (Test-Path $npxTest)) {
            $npmCmd = $npmTest
            $npxCmd = $npxTest
            Write-Success "npm encontrado em: $p"
            break
        }
    }
}

if (-not $npmCmd) {
    Write-Error "Node.js/npm NÃO encontrado!"
    Write-Host "`nSoluções:" -ForegroundColor Yellow
    Write-Host "1. Instale o Node.js: https://nodejs.org (versão LTS)" -ForegroundColor White
    Write-Host "2. Feche e reabra o PowerShell após instalar" -ForegroundColor White
    Write-Host "3. Ou adicione ao PATH: C:\Program Files\nodejs" -ForegroundColor White
    Read-Host "`nPressione Enter para sair"
    exit 1
}

# ============================================
# 2. NPM INSTALL
# ============================================
Write-Header "2/5 — Instalando dependências"
try {
    & $npmCmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install falhou" }
    Write-Success "Dependências instaladas"
} catch {
    Write-Error "Falha ao instalar dependências"
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ============================================
# 3. BUILD
# ============================================
Write-Header "3/5 — Buildando projeto"
try {
    & $npmCmd run build
    if ($LASTEXITCODE -ne 0) { throw "build falhou" }
    Write-Success "Build concluído"
} catch {
    Write-Error "Falha no build"
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ============================================
# 4. DEPLOY VERCEL
# ============================================
Write-Header "4/5 — Deploy na Vercel"
Write-Host "Será solicitado login na Vercel (se necessário)..." -ForegroundColor Yellow
Write-Host "Responda as perguntas do CLI abaixo:" -ForegroundColor Yellow
Write-Host ""

try {
    & $npxCmd vercel --prod
    if ($LASTEXITCODE -ne 0) { throw "deploy falhou" }
    Write-Success "Deploy enviado!"
} catch {
    Write-Error "Falha no deploy"
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ============================================
# 5. SUPABASE (instruções)
# ============================================
Write-Header "5/5 — Próximos passos (Supabase)"
Write-Host @"

O frontend foi deployado! Agora configure o backend:

1. Acesse: https://supabase.com/dashboard/project/rwaezeqyuhxrssntcxdv

2. Vá em SQL Editor → New Query
   Cole TODO o conteúdo do arquivo: database-setup.sql
   Clique em RUN

3. Vá em Authentication → Users → Add User
   Crie 3 usuários:
   • produtor@aura.teste / senha123
   • admin@aura.teste / senha123
   • user@aura.teste / senha123

4. Vá em Storage → New bucket
   Crie: event-images, avatars, producer-logos (todos públicos)

5. Pronto! O site usará dados reais do Supabase.
   (Até lá, funciona 100% no modo demo)

"@ -ForegroundColor White

Write-Header "DEPLOY CONCLUÍDO 🚀"
Write-Host "URL do projeto: https://aura-platform-fodcshzgh-scoprics-projects.vercel.app" -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione Enter para fechar"
