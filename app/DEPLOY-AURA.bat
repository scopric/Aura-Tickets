@echo off
chcp 65001 >nul
echo ==========================================
echo   AURA TICKETS — Deploy para Vercel
echo ==========================================
echo.

set PROJECT_DIR=%~dp0
set NODE_MODULES=%PROJECT_DIR%node_modules

cd /d "%PROJECT_DIR%"

REM Verificar se Node.js esta instalado
node --version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale o Node.js v20+ primeiro.
  pause
  exit /b 1
)

echo [1/4] Node.js detectado:
node --version
echo.

REM Verificar se node_modules existe
if not exist "%NODE_MODULES%" (
  echo [2/4] node_modules nao encontrado. Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
  )
) else (
  echo [2/4] node_modules encontrado. Pulando install.
)
echo.

REM Build
echo [3/4] Executando build...
call npm run build
if errorlevel 1 (
  echo.
  echo [ERRO] Build falhou! Corrija os erros acima e tente novamente.
  pause
  exit /b 1
)
echo.
echo [OK] Build concluido com sucesso!
echo.

REM Deploy
echo [4/4] Iniciando deploy na Vercel...
echo.
echo Se for a primeira vez, o CLI vai pedir para vincular um projeto.
echo Escolha "N" para criar um novo projeto.
echo.
npx vercel --prod
if errorlevel 1 (
  echo.
  echo [ERRO] Deploy falhou.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   Deploy concluido!
echo ==========================================
pause
