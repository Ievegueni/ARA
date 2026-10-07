@echo off
rem Arranca o Assistente de Avarias e abre o navegador. Ver docs\WINDOWS.md
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start.ps1" %*
echo.
pause
