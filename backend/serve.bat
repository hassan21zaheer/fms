@echo off
set "PATH=D:\laragon\bin\php\php-8.3.36-Win32-vs16-x64;D:\laragon\bin\composer;%PATH%"
cd /d D:\fms\backend
php artisan serve --host=127.0.0.1 --port=8000
pause
