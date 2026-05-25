@echo off
chcp 65001 >nul
title Evokaa Tickets - Deploy

:: Este batch chama o PowerShell para executar o deploy
:: Necessário porque o cmd não lida bem com espaços no caminho

echo ============================================
echo   AURA TICKETS — DEPLOY AUTOMATICO
echo ============================================
echo.

:: Detectar pasta deste arquivo
set "SCRIPT_DIR=%~dp0"
set "PS1_FILE=%SCRIPT_DIR%DEPLOY-AURA.ps1"

echo Detectado: %PS1_FILE%
echo.

:: Verificar se o arquivo existe
if not exist "%PS1_FILE%" (
    echo ERRO: Arquivo DEPLOY-AURA.ps1 nao encontrado!
    echo Verifique se esta na mesma pasta.
    pause
    exit /b 1
)

:: Chamar PowerShell com permissao para executar scripts
echo Abrindo PowerShell...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%PS1_FILE%'"

if %errorlevel% neq 0 (
    echo.
    echo ============================================
    echo   ERRO no deploy
    echo ============================================
    pause
    exit /b 1
)
