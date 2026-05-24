@echo off
chcp 65001 >nul
title Extrair Texto dos PDFs - Aura Documentos
cls

echo ============================================
echo   EXTRAÇÃO DE TEXTO DOS PDFS
echo   Aura Tickets - Aura Documentos
echo ============================================
echo.

REM Verificar se Python está disponível
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python encontrado. Executando extrair_pdfs.py...
    echo.
    python extrair_pdfs.py
    goto fim
)

py --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python (py) encontrado. Executando extrair_pdfs.py...
    echo.
    py extrair_pdfs.py
    goto fim
)

python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python3 encontrado. Executando extrair_pdfs.py...
    echo.
    python3 extrair_pdfs.py
    goto fim
)

REM Se não achou Python, tentar PowerShell
echo [!] Python não encontrado. Tentando PowerShell...
echo.

powershell -ExecutionPolicy Bypass -File "extrair_pdfs.ps1"
if %errorlevel% == 0 goto fim

echo.
echo [ERRO] Não foi possível executar a extração automaticamente.
echo.
echo Para extrair manualmente, você pode:
echo   1. Instalar Python (python.org) e rodar: pip install PyMuPDF
echo   2. Ou abrir cada PDF, selecionar tudo (Ctrl+A), copiar (Ctrl+C)
echo      e colar em um arquivo .txt
echo   3. Ou usar um conversor online de PDF para TXT
echo.

:fim
echo.
echo Pressione qualquer tecla para sair...
pause >nul
