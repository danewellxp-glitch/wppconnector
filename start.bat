@echo off
echo ========================================
echo   WPPConnector - Iniciando sistema
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando Docker (Postgres, Redis, WAHA)...
docker compose ps -a 2>nul | findstr /C:"wpp-postgres" >nul
if errorlevel 1 (
  echo    Docker nao esta rodando ou containers nao existem.
  echo    Execute: docker compose up -d
  echo.
) else (
  echo    Docker OK.
  echo.
)

echo [2/3] Iniciando BACKEND na porta 4000...
start "WPPConnector Backend" cmd /k "cd /d "%~dp0backend" && npm run start:dev"
echo    Aguardando backend subir (15 segundos)...
timeout /t 15 /nobreak >nul
echo.

echo [3/3] Iniciando FRONTEND na porta 3000...
start "WPPConnector Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo.
echo ========================================
echo   Pronto! Abra no navegador:
echo   http://localhost:3000
echo ========================================
echo.
echo Backend: http://localhost:4000/api
echo Feche as janelas do backend e frontend para parar.
pause
