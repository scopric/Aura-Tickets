# ============================================================
# Evokaa Tickets - Deploy para Vercel
# Script unico: instala dependencias, commit, push e deploy
# ============================================================

$ErrorActionPreference = "Stop"

# --- CONFIGURACOES ---
$projectPath = "C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Aura Tickets\app"
$commitMessage = "deploy: landing page fixes, env vars, domain config"

# --- VALIDACAO ---
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   EVOKAA TICKETS - DEPLOY PARA VERCEL" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if (-not (Test-Path $projectPath)) {
    Write-Host "ERRO: Diretorio do projeto nao encontrado:" -ForegroundColor Red
    Write-Host "  $projectPath" -ForegroundColor Red
    Write-Host "`nVerifique se o caminho esta correto e tente novamente." -ForegroundColor Red
    exit 1
}

Set-Location $projectPath
Write-Host "Diretorio do projeto: $projectPath" -ForegroundColor Green

# Verificar env vars locais
$envLocal = Join-Path $projectPath ".env.local"
$hasEnvVars = $false
if (Test-Path $envLocal) {
    $envContent = Get-Content $envLocal -Raw
    $hasUrl = $envContent -match 'VITE_SUPABASE_URL'
    $hasKey = $envContent -match 'VITE_SUPABASE_ANON_KEY'
    $hasEnvVars = $hasUrl -and $hasKey
}

Write-Host "`n----------------------------------------" -ForegroundColor DarkGray
if ($hasEnvVars) {
    Write-Host "[INFO] Variaveis de ambiente encontradas em .env.local" -ForegroundColor Green
} else {
    Write-Host "[AVISO] .env.local nao encontrado ou incompleto!" -ForegroundColor Red
}
Write-Host "[AVISO] Lembre-se de configurar as env vars no painel Vercel:" -ForegroundColor Yellow
Write-Host "  VITE_SUPABASE_URL" -ForegroundColor White
Write-Host "  VITE_SUPABASE_ANON_KEY" -ForegroundColor White
Write-Host "[AVISO] Domínio customizado (www.evokaa.com.br) deve ser" -ForegroundColor Yellow
Write-Host "        configurado em: Vercel Dashboard > aura-platform > Settings > Domains" -ForegroundColor Yellow
Write-Host "----------------------------------------`n" -ForegroundColor DarkGray

# Verificar se e um repositorio git
$gitDir = Join-Path (Split-Path $projectPath -Parent) ".git"
if (-not (Test-Path $gitDir)) {
    Write-Host "AVISO: Repositorio Git nao encontrado na raiz." -ForegroundColor Yellow
    Write-Host "Certifique-se de que o projeto esta clonado do GitHub." -ForegroundColor Yellow
}

# --- PASSO 1: INSTALAR DEPENDENCIAS ---
Write-Host "`n[1/5] Instalando dependencias do Node.js..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: npm install falhou." -ForegroundColor Red
    exit 1
}
Write-Host "Dependencias instaladas com sucesso!" -ForegroundColor Green

# --- PASSO 2: INSTALAR BROWSERS DO PLAYWRIGHT ---
Write-Host "`n[2/5] Instalando browsers do Playwright..." -ForegroundColor Cyan
npx playwright install
if ($LASTEXITCODE -ne 0) {
    Write-Host "AVISO: Instalacao do Playwright falhou, mas o build pode continuar." -ForegroundColor Yellow
} else {
    Write-Host "Browsers do Playwright instalados!" -ForegroundColor Green
}

# --- PASSO 3: VERIFICAR BUILD ---
Write-Host "`n[3/5] Verificando build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Build falhou. Corrija os erros acima antes de continuar." -ForegroundColor Red
    exit 1
}
Write-Host "Build realizado com sucesso!" -ForegroundColor Green

# --- PASSO 4: GIT ADD / COMMIT / PUSH ---
Write-Host "`n[4/5] Fazendo commit e push para o GitHub..." -ForegroundColor Cyan

# Voltar para a raiz do repo (onde esta .git)
Set-Location (Split-Path $projectPath -Parent)

git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: git add falhou." -ForegroundColor Red
    exit 1
}

# Verificar se ha mudancas para commitar
$status = git status --short
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Nenhuma mudanca para commitar. Pulando para deploy..." -ForegroundColor Yellow
} else {
    git commit -m "$commitMessage"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: git commit falhou." -ForegroundColor Red
        exit 1
    }

    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: git push falhou. Verifique suas credenciais." -ForegroundColor Red
        exit 1
    }
    Write-Host "Codigo enviado para o GitHub com sucesso!" -ForegroundColor Green
}

# --- PASSO 5: DEPLOY VERCEL ---
Write-Host "`n[5/5] Fazendo deploy no Vercel..." -ForegroundColor Cyan
Set-Location $projectPath

# Verificar se vercel CLI esta instalado
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "Vercel CLI nao encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "`nIniciando deploy de producao..." -ForegroundColor Cyan
vercel --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERRO: Deploy no Vercel falhou." -ForegroundColor Red
    Write-Host "Possiveis causas:" -ForegroundColor Yellow
    Write-Host "  - Nao esta logado no Vercel. Rode: npx vercel login" -ForegroundColor Yellow
    Write-Host "  - Projeto nao vinculado. Rode: npx vercel link" -ForegroundColor Yellow
    Write-Host "  - Variaveis de ambiente faltando no painel Vercel" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "   DEPLOY CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n[IMPORTANTE] Verifique se estao configurados no Vercel:" -ForegroundColor Yellow
Write-Host "  1. Settings > Environment Variables:" -ForegroundColor Cyan
Write-Host "     VITE_SUPABASE_URL" -ForegroundColor White
Write-Host "     VITE_SUPABASE_ANON_KEY" -ForegroundColor White
Write-Host "  2. Settings > Domains:" -ForegroundColor Cyan
Write-Host "     www.evokaa.com.br" -ForegroundColor White
Write-Host "  3. DNS no registrador:" -ForegroundColor Cyan
Write-Host "     CNAME www -> cname.vercel-dns.com" -ForegroundColor White
Write-Host "`nPara verificar se funcionou:" -ForegroundColor Cyan
Write-Host "  https://www.evokaa.com.br/" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Green
