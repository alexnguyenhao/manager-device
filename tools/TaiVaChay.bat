@echo off
setlocal
chcp 65001 >nul
title Manager Device - Tai va chay cong cu thu thap cau hinh
color 0B

set "URL=https://github.com/alexnguyenhao/manager-device/releases/latest/download/ManagerDevice-CongCu-ThuThap-CauHinh.zip"
set "ZIP=%TEMP%\MD-CongCu-%RANDOM%.zip"
set "DIR=%TEMP%\MD-CongCu-%RANDOM%"

echo.
echo  ==========================================================
echo   MANAGER DEVICE - CONG CU THU THAP CAU HINH
echo  ==========================================================
echo.
echo   File nay tu tai bo cong cu moi nhat tu GitHub,
echo   chay quet cau hinh may tinh / laptop / may in,
echo   roi tu xoa file tam sau khi xong.
echo.
echo   May can co Internet trong lan chay dau tien.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "try {" ^
  "  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "  Write-Host '  Dang tai bo cong cu...' -ForegroundColor Cyan;" ^
  "  Invoke-WebRequest -Uri $env:URL -OutFile $env:ZIP -UseBasicParsing;" ^
  "  Expand-Archive -LiteralPath $env:ZIP -DestinationPath $env:DIR -Force;" ^
  "  $script=Join-Path $env:DIR 'ManagerDevice-CongCu\collect-device-info.ps1';" ^
  "  if (-not (Test-Path -LiteralPath $script)) { throw 'Khong tim thay script trong goi tai ve.' }" ^
  "  & $script" ^
  "} catch {" ^
  "  Write-Host '';" ^
  "  Write-Host ('  KHONG TAI DUOC: ' + $_.Exception.Message) -ForegroundColor Red;" ^
  "  Write-Host '';" ^
  "  Write-Host '  Tai thu cong bang trinh duyet:' -ForegroundColor Yellow;" ^
  "  Write-Host ('  ' + $env:URL) -ForegroundColor Yellow;" ^
  "  Write-Host '';" ^
  "  Write-Host '  Hoac tai tren may co Internet roi chep sang may nay.' -ForegroundColor Gray;" ^
  "} finally {" ^
  "  Remove-Item -LiteralPath $env:ZIP -Force -ErrorAction SilentlyContinue;" ^
  "  Remove-Item -LiteralPath $env:DIR -Recurse -Force -ErrorAction SilentlyContinue" ^
  "}"

echo.
echo  ==========================================================
echo   Xong. File CSV nam trong Desktop\ManagerDevice-CauHinh
echo  ==========================================================
echo.
pause
