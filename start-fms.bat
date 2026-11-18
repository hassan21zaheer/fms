@echo off
rem One click start for the whole system: database check, API, alert workers and website.
set "PATH=D:\laragon\bin\php\php-8.3.36-Win32-vs16-x64;D:\laragon\bin\composer;%PATH%"

rem 1. MySQL (the database) must be running. Start Laragon's MySQL if it is not.
netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting Laragon so the database is available...
  start "" "D:\laragon\laragon.exe"
  timeout /t 12 /nobreak >nul
  netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
  if errorlevel 1 (
    echo.
    echo The database is not running yet. In Laragon click "Start All", then run this file again.
    pause
    exit /b 1
  )
)

rem 2. API server
start "FMS API  (port 8000)" cmd /k "cd /d D:\fms\backend && php artisan serve --host=127.0.0.1 --port=8000"

rem 3. Alerts and scheduled jobs (queue worker + scheduler)
start "FMS queue worker" cmd /k "cd /d D:\fms\backend && php artisan queue:work --sleep=3 --tries=3 --max-time=3600"
start "FMS scheduler" cmd /k "cd /d D:\fms\backend && php artisan schedule:work"

rem 4. Website
start "FMS website (port 3100)" cmd /k "cd /d D:\fms\frontend && npm run dev"

rem 5. Open the browser once everything has had a moment to start
timeout /t 6 /nobreak >nul
start "" http://localhost:3100

echo.
echo FMS is starting. Website: http://localhost:3100   API: http://127.0.0.1:8000
echo Close the four black windows to stop everything.
timeout /t 8 >nul
