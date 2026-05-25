@echo off
chcp 65001 >nul
echo ==========================================
echo    Evokaa Tickets - Iniciando Kimi CLI
echo ==========================================
echo.

set "PROJECT_ROOT=C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Aura Tickets"
set "AGENT_FILE=%PROJECT_ROOT%\aura-agent.yaml"

echo Diretório do projeto: %PROJECT_ROOT%
echo.

if not exist "%PROJECT_ROOT%\app" (
    echo [ERRO] Pasta 'app' não encontrada em %PROJECT_ROOT%
    echo Verifique se o caminho do projeto está correto.
    pause
    exit /b 1
)

if not exist "%AGENT_FILE%" (
    echo [ERRO] aura-agent.yaml não encontrado em %PROJECT_ROOT%
    echo O arquivo de configuração do agente é necessário para iniciar.
    pause
    exit /b 1
)

echo Abrindo PowerShell com Kimi CLI...
echo Aguarde...
echo.

:: Inicia o PowerShell, navega para o projeto e executa o Kimi com o agente customizado
start powershell -NoExit -Command "
    chcp 65001;
    Write-Host '==========================================' -ForegroundColor Cyan;
    Write-Host '   Evokaa Tickets - Agente Kimi CLI' -ForegroundColor Cyan;
    Write-Host '==========================================' -ForegroundColor Cyan;
    Write-Host '';
    Write-Host 'Diretório: %PROJECT_ROOT%' -ForegroundColor Green;
    Write-Host 'Agente: aura-tickets' -ForegroundColor Green;
    Write-Host '';
    Write-Host 'Dicas de uso:' -ForegroundColor Yellow;
    Write-Host '  /sessions        - Listar sessões anteriores' -ForegroundColor DarkGray;
    Write-Host '  --continue       - Continuar sessão mais recente' -ForegroundColor DarkGray;
    Write-Host '  /export          - Exportar sessão atual como Markdown' -ForegroundColor DarkGray;
    Write-Host '  /compact         - Compactar contexto se ficar muito longo' -ForegroundColor DarkGray;
    Write-Host '';
    cd '%PROJECT_ROOT%';
    kimi --agent-file '%AGENT_FILE%' --work-dir '%PROJECT_ROOT%';
    Write-Host '';
    Write-Host '==========================================' -ForegroundColor Cyan;
    Write-Host 'Sessão encerrada.' -ForegroundColor Cyan;
    Write-Host 'Para retomar: Iniciar-Kimi-Aura.bat --continue' -ForegroundColor DarkGray;
    Write-Host '==========================================' -ForegroundColor Cyan;
"

echo.
echo [OK] Kimi CLI iniciado em nova janela do PowerShell!
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
