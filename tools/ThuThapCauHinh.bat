@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  Manager Device - Thu thap cau hinh may tinh / laptop / may in
echo  =============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0collect-device-info.ps1" %*
echo.
pause
