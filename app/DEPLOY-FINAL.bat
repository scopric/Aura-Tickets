@echo off
chcp 65001 >nul
echo ============================================
echo   AURA TICKETS — DEPLOY FINAL
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando dependências...
call npm install
if %errorlevel% neq 0 (
  echo Erro ao instalar dependências.
  pause
  exit /b 1
)

echo.
echo [2/3] Buildando projeto...
call npm run build
if %errorlevel% neq 0 (
  echo Erro no build. Verifique os erros acima.
  pause
  exit /b 1
)

echo.
echo [3/3] Deploy para Vercel...
call npx vercel --prod
if %errorlevel% neq 0 (
  echo Erro no deploy.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   DEPLOY CONCLUÍDO!
echo ============================================
echo.
echo URL: https://aura-platform-fodcshzgh-scoprics-projects.vercel.app
echo.
pause
