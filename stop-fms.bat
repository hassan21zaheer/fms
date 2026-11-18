@echo off
rem Stops the FMS windows started by start-fms.bat.
taskkill /FI "WINDOWTITLE eq FMS API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq FMS queue worker*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq FMS scheduler*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq FMS website*" /T /F >nul 2>&1
echo FMS stopped. (Laragon and MySQL keep running.)
timeout /t 3 >nul
