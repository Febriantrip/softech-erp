@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo  SOFTECH ERP - Go Backend Development
echo ==========================================
echo.

if not exist ".env" (
    echo [ERROR] File backend\.env tidak ditemukan.
    pause
    exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" set "%%A=%%B"
)

echo [SOFTECH] Environment loaded.
echo [SOFTECH] PostgreSQL: %POSTGRES_HOST%:%POSTGRES_PORT%/%POSTGRES_DB%
echo [SOFTECH] API: http://localhost:8081
echo.
echo [SOFTECH] Starting Go API...
echo.

go run ./cmd/api

echo.
echo [SOFTECH] Backend stopped.
pause