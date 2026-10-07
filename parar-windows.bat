@echo off
rem Para o Assistente de Avarias (backend, frontend e base de dados).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\stop.ps1" %*
echo.
pause
