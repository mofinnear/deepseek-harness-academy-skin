@echo off
rem Academy skin uninstaller for DeepSeek Harness (Windows). Runs windows\uninstall.ps1 next to this file.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\uninstall.ps1"
echo.
pause
