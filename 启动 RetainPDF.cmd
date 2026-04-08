@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%docker\delivery" || goto :fail

set "APP_IMAGE=retainpdf-app:open-model-config"
set "WEB_IMAGE=retainpdf-web:open-model-config"
set "APP_PORT=44100"
set "APP_SIMPLE_PORT=44200"
set "WEB_PORT=40001"

echo [RetainPDF] Starting containers...
docker compose up -d
if errorlevel 1 goto :fail

echo [RetainPDF] Waiting for health check...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='http://127.0.0.1:40001'; $health=$url + '/health'; $deadline=(Get-Date).AddMinutes(2); do { try { $resp = Invoke-WebRequest -Uri $health -UseBasicParsing -TimeoutSec 5; if ($resp.StatusCode -eq 200) { Start-Process $url; exit 0 } } catch { }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); Start-Process $url; exit 0"

echo [RetainPDF] Ready: http://127.0.0.1:40001
exit /b 0

:fail
echo [RetainPDF] Start failed. Please make sure the Docker engine is running in the background.
pause
exit /b 1
