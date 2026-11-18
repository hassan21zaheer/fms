@echo off
rem Starts the two background processes that send alerts: the queue worker and the scheduler.
set "PATH=D:\laragon\bin\php\php-8.3.36-Win32-vs16-x64;D:\laragon\bin\composer;%PATH%"
cd /d D:\fms\backend
start "FMS queue worker" cmd /k php artisan queue:work --sleep=3 --tries=3 --max-time=3600
start "FMS scheduler" cmd /k php artisan schedule:work
