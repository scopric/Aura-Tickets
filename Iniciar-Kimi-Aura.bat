@echo off
chcp 65001 >nul
echo ==========================================
echo    Aura Tickets - Iniciando Kimi CLI
echo ==========================================
echo.

set "PROJECT_ROOT=C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Aura Tickets"
set "AGENT_FILE=%PROJECT_ROOT%\aura-agent.yaml"

echo Diretorio do projeto: %PROJECT_ROOT%
echo.

if not exist "%PROJECT_ROOT%\app" (
    echo [ERRO] Pasta 'app' nao encontrada em "%PROJECT_ROOT%"
    echo Verifique se o caminho do projeto esta correto.
    pause
    exit /b 1
)

if not exist "%AGENT_FILE%" (
    echo [ERRO] aura-agent.yaml nao encontrado em "%PROJECT_ROOT%"
    echo O arquivo de configuracao do agente e necessario para iniciar.
    pause
    exit /b 1
)

echo Abrindo PowerShell com Kimi CLI...
echo Aguarde...
echo.

:: Passa as variaveis como variaveis de ambiente para o PowerShell
:: Isso garante que caminhos com espacos sejam tratados corretamente
set "AURA_PROJECT_ROOT=%PROJECT_ROOT%"
set "AURA_AGENT_FILE=%AGENT_FILE%"

start powershell -NoExit -Command "
    chcp 65001 | Out-Null;
    Write-Host '==========================================' -ForegroundColor Cyan;
    Write-Host '   Aura Tickets - Agente Kimi CLI' -ForegroundColor Cyan;
    Write-Host '==========================================' -ForegroundColor Cyan;
    Write-Host '';
    Write-Host ('Diretorio: ' + $$env:AURA_PROJECT_ROOT) -ForegroundColor Green;
    Write-Host 'Agente: aura-tickets' -ForegroundColor Green;
    Write-Host '';
    Write-Host 'Dicas de uso:' -ForegroundColor Yellow;
    Write-Host '  /sessions        - Listar sessoes anteriores' -ForegroundColor DarkGray;
    Write-Host '  --continue       - Continuar sessao mais recente' -ForegroundColor DarkGray;
    Write-Host '  /export          - Exportar sessao atual como Markdown' -ForegroundColor DarkGray;
    Write-Host '  /compact         - Compactar contexto se ficar muito longo' -ForegroundColor DarkGray;
    Write-Host '';
    Set-Location -LiteralPath $$env:AURA_PROJECT_ROOT;
    $$kimiArgs = @(
        '--agent-file', $$env:AURA_AGENT_FILE,
        '--work-dir', $$env:AURA_PROJECT_ROOT
    );
    & kimi @kimiArgs;
    Write-Host '';
    Write-Host '==========================================' -ForegroundColor Cyan;
    Write-Host 'Sessao encerrada.' -ForegroundColor Cyan;
    Write-Host 'Para retomar: .\Iniciar-Kimi-Aura.ps1 -Continue' -ForegroundColor DarkGray;
    Write-Host '==========================================' -ForegroundColor Cyan;
"

echo.
echo [OK] Kimi CLI iniciado em nova janela do PowerShell!
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
