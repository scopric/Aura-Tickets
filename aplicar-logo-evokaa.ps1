# ============================================================
# Script: Aplicar Logo Evokaa
# Descricao: Copia a nova logo do Downloads para o projeto
#            e renomeia arquivos AuraStore -> EvokaaStore
# ============================================================

$ErrorActionPreference = "Stop"

$projectRoot = "C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Aura Tickets"
$sourceImage = "C:\Users\scopa\Downloads\Gemini_Generated_Image_6lelw86lelw86lel.jpg"

$destDirs = @(
    "$projectRoot\app\public\images",
    "$projectRoot\app\dist\images",
    "$projectRoot\aura-complete-source\app\public\images"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   APLICAR LOGO EVOKAA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar imagem fonte
if (-not (Test-Path $sourceImage)) {
    Write-Host "ERRO: Imagem nao encontrada em:" -ForegroundColor Red
    Write-Host "  $sourceImage" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifique o nome do arquivo e tente novamente." -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/3] Imagem fonte encontrada." -ForegroundColor Green
Write-Host ""

# Criar diretorios se nao existirem e copiar logo
foreach ($dir in $destDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Criado diretorio: $dir" -ForegroundColor DarkGray
    }

    $destFile = Join-Path $dir "logo-evokaa.png"
    Copy-Item -Path $sourceImage -Destination $destFile -Force
    Write-Host "  Copiado: $destFile" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/3] Logo copiada para todos os destinos." -ForegroundColor Green
Write-Host ""

# Remover logo antiga (opcional)
foreach ($dir in $destDirs) {
    $oldLogo = Join-Path $dir "logo-aura.png"
    if (Test-Path $oldLogo) {
        Remove-Item -Path $oldLogo -Force
        Write-Host "  Removido: $oldLogo" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "[3/3] Renomeando arquivos de componentes..." -ForegroundColor Cyan
Write-Host ""

$filesToRename = @(
    @{ Old = "$projectRoot\app\src\pages\producer\AuraStore.tsx"; New = "$projectRoot\app\src\pages\producer\EvokaaStore.tsx" },
    @{ Old = "$projectRoot\app\src\pages\producer\AuraAcademy.tsx"; New = "$projectRoot\app\src\pages\producer\EvokaaAcademy.tsx" }
)

foreach ($item in $filesToRename) {
    if (Test-Path $item.Old) {
        Rename-Item -Path $item.Old -NewName $item.New -Force
        Write-Host "  Renomeado: $($item.Old) -> EvokaaStore.tsx / EvokaaAcademy.tsx" -ForegroundColor Green
    } else {
        Write-Host "  AVISO: Arquivo nao encontrado: $($item.Old)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   CONCLUIDO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Execute 'npm run build' dentro da pasta 'app/'" -ForegroundColor White
Write-Host "  2. Verifique se a nova logo aparece no site" -ForegroundColor White
Write-Host ""
