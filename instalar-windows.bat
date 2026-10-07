@echo off
rem Instala o Assistente de Avarias no Windows (correr uma vez). Ver docs\WINDOWS.md
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\setup.ps1" %*
echo.
pause
