@echo off
chcp 65001 >nul
title Aura Tickets - Deploy

set "PS1=%~dp0DEPLOY-VERCEL.ps1"

if not exist "%PS1%" (
    echo ERROR: DEPLOY-VERCEL.ps1 not found
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "& ""%PS1%"""

pause
