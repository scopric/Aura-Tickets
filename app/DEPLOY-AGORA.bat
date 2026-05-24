@echo off
chcp 65001 >nul
echo ==========================================
echo   AURA TICKETS - DEPLOY AUTOMATICO
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/2] Fazendo build...
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Build falhou!
    echo.
    pause
    exit /b 1
)

echo.
echo [2/2] Deployando na Vercel...
echo.
call npx vercel --prod

echo.
echo ==========================================
echo   Deploy finalizado!
echo ==========================================
echo.
pause
