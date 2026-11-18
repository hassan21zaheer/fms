@echo off
rem Saves a full copy of the database into D:\fms\backend\database\backups
set "PATH=D:\laragon\bin\php\php-8.3.36-Win32-vs16-x64;%PATH%"
cd /d D:\fms\backend
php artisan fms:backup-database
pause
