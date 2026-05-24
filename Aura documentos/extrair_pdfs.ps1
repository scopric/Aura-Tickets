# Script PowerShell para extrair texto dos PDFs da pasta Aura documentos
# Como usar: clique com botão direito → "Executar com PowerShell"
# Ou abra PowerShell nesta pasta e rode: .\extrair_pdfs.ps1

$PastaPDFs = $PSScriptRoot
$PastaSaida = Join-Path $PastaPDFs "texto_extraido"

# Criar pasta de saída
New-Item -ItemType Directory -Path $PastaSaida -Force | Out-Null

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "EXTRAÇÃO DE TEXTO DOS PDFS - AURA DOCUMENTOS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Pasta de origem: $PastaPDFs"
Write-Host "Pasta de saída:  $PastaSaida"
Write-Host ""

# Verificar se iTextSharp.dll existe localmente ou baixar
$DllPath = Join-Path $PastaSaida "itextsharp.dll"
if (-not (Test-Path $DllPath)) {
    Write-Host "Baixando iTextSharp.dll..." -ForegroundColor Yellow
    try {
        $url = "https://github.com/itext/itextsharp/releases/download/5.5.13.3/itextsharp.dll"
        Invoke-WebRequest -Uri $url -OutFile $DllPath -UseBasicParsing
        Write-Host "Download concluído!" -ForegroundColor Green
    } catch {
        Write-Host "Falha no download automático. Tentando método alternativo..." -ForegroundColor Red
    }
}

# Método 1: Usar iTextSharp se disponível
$Metodo = ""
if (Test-Path $DllPath) {
    try {
        Add-Type -Path $DllPath
        $Metodo = "iTextSharp"
        Write-Host "Usando iTextSharp para extração..." -ForegroundColor Green
    } catch {
        Write-Host "iTextSharp não pôde ser carregado." -ForegroundColor Red
    }
}

# Método 2: Verificar se pdftotext (poppler) está no PATH
if ($Metodo -eq "") {
    $pdftotext = Get-Command pdftotext -ErrorAction SilentlyContinue
    if ($pdftotext) {
        $Metodo = "pdftotext"
        Write-Host "Usando pdftotext para extração..." -ForegroundColor Green
    }
}

# Método 3: Verificar se python com PyPDF2/pypdf está disponível
if ($Metodo -eq "") {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
    if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
    
    if ($python) {
        $PyCmd = $python.Source
        # Verificar se pypdf está instalado
        $testPypdf = & $PyCmd -c "import pypdf; print('ok')" 2>$null
        if ($testPypdf -eq "ok") {
            $Metodo = "python-pypdf"
            Write-Host "Usando Python + pypdf para extração..." -ForegroundColor Green
        } else {
            # Tentar PyMuPDF
            $testFitz = & $PyCmd -c "import fitz; print('ok')" 2>$null
            if ($testFitz -eq "ok") {
                $Metodo = "python-fitz"
                Write-Host "Usando Python + PyMuPDF para extração..." -ForegroundColor Green
            } else {
                Write-Host "Python encontrado mas sem bibliotecas PDF instaladas." -ForegroundColor Yellow
                Write-Host "Instalando pypdf..." -ForegroundColor Yellow
                & $PyCmd -m pip install pypdf -q
                $testPypdf2 = & $PyCmd -c "import pypdf; print('ok')" 2>$null
                if ($testPypdf2 -eq "ok") {
                    $Metodo = "python-pypdf"
                    Write-Host "pypdf instalado com sucesso!" -ForegroundColor Green
                }
            }
        }
    }
}

if ($Metodo -eq "") {
    Write-Host ""
    Write-Host "ERRO: Nenhum método de extração disponível!" -ForegroundColor Red
    Write-Host "Instale uma das opções abaixo:" -ForegroundColor Yellow
    Write-Host "  1. Python + pypdf:  pip install pypdf"
    Write-Host "  2. Python + PyMuPDF: pip install PyMuPDF"
    Write-Host "  3. Poppler (pdftotext): choco install poppler"
    Write-Host ""
    Write-Host "Pressione qualquer tecla para sair..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Listar todos os PDFs
$PDFs = Get-ChildItem -Path $PastaPDFs -Filter "*.pdf"
Write-Host ""
Write-Host "Encontrados $($PDFs.Count) PDFs para extrair." -ForegroundColor Cyan
Write-Host ""

foreach ($pdf in $PDFs) {
    $NomeBase = [System.IO.Path]::GetFileNameWithoutExtension($pdf.Name)
    $SaidaTxt = Join-Path $PastaSaida "$NomeBase.txt"
    
    Write-Host "Extraindo: $($pdf.Name) ..." -NoNewline
    
    try {
        switch ($Metodo) {
            "iTextSharp" {
                $reader = New-Object iTextSharp.text.pdf.PdfReader($pdf.FullName)
                $sb = New-Object System.Text.StringBuilder
                for ($i = 1; $i -le $reader.NumberOfPages; $i++) {
                    $strategy = New-Object iTextSharp.text.pdf.parser.SimpleTextExtractionStrategy
                    $text = [iTextSharp.text.pdf.parser.PdfTextExtractor]::GetTextFromPage($reader, $i, $strategy)
                    [void]$sb.AppendLine($text)
                }
                $reader.Close()
                $sb.ToString() | Out-File -FilePath $SaidaTxt -Encoding utf8
            }
            "pdftotext" {
                & pdftotext -layout $pdf.FullName $SaidaTxt
            }
            "python-pypdf" {
                $ScriptPy = @"
import pypdf, sys
reader = pypdf.PdfReader(sys.argv[1])
text = ''
for page in reader.pages:
    text += page.extract_text() + '\n'
with open(sys.argv[2], 'w', encoding='utf-8') as f:
    f.write(text)
"@
                $TempPy = Join-Path $env:TEMP "extract_pdf.py"
                $ScriptPy | Out-File -FilePath $TempPy -Encoding utf8
                & $PyCmd $TempPy $pdf.FullName $SaidaTxt
            }
            "python-fitz" {
                $ScriptPy = @"
import fitz, sys
doc = fitz.open(sys.argv[1])
text = ''
for page in doc:
    text += page.get_text()
doc.close()
with open(sys.argv[2], 'w', encoding='utf-8') as f:
    f.write(text)
"@
                $TempPy = Join-Path $env:TEMP "extract_pdf.py"
                $ScriptPy | Out-File -FilePath $TempPy -Encoding utf8
                & $PyCmd $TempPy $pdf.FullName $SaidaTxt
            }
        }
        
        $Tamanho = (Get-Item $SaidaTxt).Length
        if ($Tamanho -gt 0) {
            Write-Host " OK ($Tamanho bytes)" -ForegroundColor Green
        } else {
            Write-Host " AVISO (arquivo vazio)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host " ERRO: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "EXTRAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "Arquivos salvos em: $PastaSaida" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
