@echo off
echo ========================================
echo   WPPConnector - Encerrando aplicacao
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Encerrando FRONTEND (porta 3000)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
  echo    Processo %%a encerrado.
)
echo    Frontend encerrado.
echo.

echo [2/2] Encerrando BACKEND (porta 4000)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
  echo    Processo %%a encerrado.
)
echo    Backend encerrado.
echo.

echo ========================================
echo   Aplicacao encerrada.
echo   Docker (Postgres, Redis, WAHA) continua rodando.
echo   Para parar tudo: docker compose down
echo ========================================
pause
