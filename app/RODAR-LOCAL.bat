@echo off
chcp 65001 >nul
echo ==========================================
echo   AURA TICKETS - SERVIDOR LOCAL
echo ==========================================
echo.
echo Acesse: http://localhost:3000
echo.

REM Entra na pasta do projeto
cd /d "%~dp0"

REM Instala dependencias se necessario
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)

REM Inicia o servidor
call npm run dev

pause
