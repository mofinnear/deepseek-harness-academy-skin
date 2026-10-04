@echo off
rem Academy skin installer for DeepSeek Harness (Windows). Runs windows\install.ps1 next to this file.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\install.ps1"
echo.
pause
