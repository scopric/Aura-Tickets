#requires -Version 5.1
<#
.SYNOPSIS
    Inicializa o Kimi CLI com o contexto completo do projeto Aura Tickets.

.DESCRIPTION
    Este script configura e inicia o Kimi Code CLI com:
    - Agente customizado (aura-agent.yaml)
    - System prompt dedicado com instruções do projeto
    - Diretório de trabalho correto (raiz do projeto)
    - Integração automática com AGENTS.md e KIMI_MEMORY.md

.USAGE
    .\Iniciar-Kimi-Aura.ps1              # Inicia nova sessão
    .\Iniciar-Kimi-Aura.ps1 -Continue    # Continua sessão anterior
    .\Iniciar-Kimi-Aura.ps1 -Session     # Escolhe sessão para retomar

.NOTES
    Autor: Sistema Aura
    Versão: 1.0
#>

[CmdletBinding()]
param(
    [switch]$Continue,
    [switch]$Session,
    [switch]$Yolo
)

# ==========================================
# CONFIGURAÇÕES
# ==========================================
$ProjectRoot = "C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Aura Tickets"
$AgentFile   = "$ProjectRoot\aura-agent.yaml"
$MemoryFile  = "$ProjectRoot\KIMI_MEMORY.md"

# ==========================================
# CABEÇALHO
# ==========================================
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Aura Tickets - Iniciando Kimi CLI" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ==========================================
# VALIDAÇÕES
# ==========================================

# Verificar pasta do projeto
if (-not (Test-Path $ProjectRoot -PathType Container)) {
    Write-Error "[ERRO] Pasta do projeto não encontrada: $ProjectRoot"
    exit 1
}

# Verificar pasta app (código fonte real)
if (-not (Test-Path "$ProjectRoot\app" -PathType Container)) {
    Write-Error "[ERRO] Pasta 'app' (código fonte) não encontrada em $ProjectRoot"
    exit 1
}

# Verificar arquivo do agente
if (-not (Test-Path $AgentFile -PathType Leaf)) {
    Write-Error "[ERRO] Arquivo de agente não encontrado: $AgentFile"
    exit 1
}

# Verificar se kimi está instalado
$kimiCmd = Get-Command kimi -ErrorAction SilentlyContinue
if (-not $kimiCmd) {
    Write-Warning "[AVISO] Comando 'kimi' não encontrado no PATH."
    Write-Host "        Verifique se o Kimi CLI está instalado corretamente." -ForegroundColor Yellow
    Write-Host "        Instalação: https://moonshotai.github.io/kimi-cli/" -ForegroundColor Yellow
    Write-Host ""
    $prosseguir = Read-Host "Deseja tentar prosseguir mesmo assim? (S/N)"
    if ($prosseguir -notmatch '^[Ss]') {
        exit 1
    }
}

# ==========================================
# INFORMAÇÕES
# ==========================================
Write-Host "Diretório do projeto: " -NoNewline; Write-Host $ProjectRoot -ForegroundColor Green
Write-Host "Código fonte:        " -NoNewline; Write-Host "$ProjectRoot\app" -ForegroundColor Green
Write-Host "Arquivo do agente:   " -NoNewline; Write-Host $AgentFile -ForegroundColor Green
Write-Host "Memória do projeto:  " -NoNewline; Write-Host $MemoryFile -ForegroundColor Green
Write-Host ""

# Verificar se há memória existente
if (Test-Path $MemoryFile -PathType Leaf) {
    $memSize = (Get-Item $MemoryFile).Length
    Write-Host "[INFO] KIMI_MEMORY.md encontrado ($memSize bytes) — será carregado automaticamente." -ForegroundColor DarkGray
} else {
    Write-Warning "[AVISO] KIMI_MEMORY.md não encontrado. O agente criará um novo."
}

Write-Host ""

# ==========================================
# MONTAR ARGUMENTOS DO KIMI
# ==========================================
$kimiArgs = @("--agent-file", $AgentFile, "--work-dir", $ProjectRoot)

if ($Continue) {
    $kimiArgs += "--continue"
    Write-Host "[MODO] Continuando sessão anterior..." -ForegroundColor Yellow
}
elseif ($Session) {
    $kimiArgs += "--session"
    Write-Host "[MODO] Selecionando sessão para retomar..." -ForegroundColor Yellow
}

if ($Yolo) {
    $kimiArgs += "--yolo"
    Write-Host "[MODO] YOLO ativado (aprovação automática de ferramentas)." -ForegroundColor Magenta
}

# ==========================================
# INICIAR KIMI
# ==========================================
Write-Host "Iniciando Kimi CLI..." -ForegroundColor Cyan
Write-Host "(Pressione Ctrl+C para sair a qualquer momento)" -ForegroundColor DarkGray
Write-Host ""

Set-Location $ProjectRoot

& kimi @kimiArgs

# ==========================================
# FINALIZAÇÃO
# ==========================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Sessão encerrada." -ForegroundColor Cyan
Write-Host ""
Write-Host "Comandos úteis para a próxima vez:" -ForegroundColor Yellow
Write-Host "  .\Iniciar-Kimi-Aura.ps1 -Continue    - Retomar esta sessão" -ForegroundColor DarkGray
Write-Host "  .\Iniciar-Kimi-Aura.ps1 -Session     - Escolher sessão anterior" -ForegroundColor DarkGray
Write-Host "  kimi --session                        - Mesmo que acima" -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
