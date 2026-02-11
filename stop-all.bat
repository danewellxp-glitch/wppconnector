@echo off
echo ========================================
echo   WPPConnector - Encerrando TUDO
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Encerrando FRONTEND (porta 3000)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)
echo    OK.
echo.

echo [2/3] Encerrando BACKEND (porta 4000)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)
echo    OK.
echo.

echo [3/3] Parando Docker (Postgres, Redis, WAHA)...
docker compose down 2>nul
echo    OK.
echo.

echo ========================================
echo   Tudo encerrado (app + containers).
echo ========================================
pause
