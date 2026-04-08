@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%docker\delivery" || goto :fail

echo [RetainPDF] Stopping containers...
docker compose down
if errorlevel 1 goto :fail

echo [RetainPDF] Stopped.
exit /b 0

:fail
echo [RetainPDF] Stop failed. Please make sure the Docker engine is running in the background.
pause
exit /b 1
