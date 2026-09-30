@echo off
setlocal
cd /d "%~dp0"
title NEXA ERP Distributor

echo ==========================================
echo       NEXA ERP Distributor - START
echo ==========================================
echo.

if not exist "package.json" (
  echo [ERROR] package.json tidak ditemukan di folder ini.
  echo Extract seluruh isi ZIP langsung ke folder project ERP.
  pause
  exit /b 1
)

if not exist "index.html" (
  echo [ERROR] index.html tidak ditemukan.
  echo Project belum lengkap. Extract repair overlay sekali lagi.
  pause
  exit /b 1
)

if not exist "src\main.jsx" (
  echo [ERROR] src\main.jsx tidak ditemukan.
  echo Project belum lengkap. Extract repair overlay sekali lagi.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm tidak ditemukan. Install Node.js LTS lalu coba lagi.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] node_modules belum ada. Menjalankan npm install...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install gagal. Lihat pesan error di atas.
    pause
    exit /b 1
  )
)

echo.
echo [INFO] Menjalankan ERP di Vite dev server...
echo [INFO] Setelah muncul Local URL, buka URL tersebut di browser.
echo.
call npm run dev

pause
endlocal
