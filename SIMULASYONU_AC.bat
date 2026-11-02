@echo off
chcp 65001 >nul
title ZENITH Inis Tezgahi - kapatmak icin bu pencereyi kapatin
cd /d "%~dp0"

echo.
echo   ZENITH Inis Tezgahi
echo   ===================
echo.
echo   Tarayici birazdan acilacak.
echo.
echo   KAPATMAK ICIN: bu siyah pencereyi kapatin (sag ustteki X).
echo   Pencere acik kaldigi surece simulasyon calisir.
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo   HATA: Python bulunamadi.
  echo   Simulasyonu internetten acabilirsiniz, Python gerekmez:
  echo   https://emreyaman1.github.io/zenith-inis-tezgahi/
  echo.
  pause
  exit /b 1
)

rem Bos bir kapi bul (8777'den baslayip yukari dogru dener)
set PORT=
for %%p in (8777 8778 8779 8780 8781) do (
  if not defined PORT (
    netstat -ano | findstr /c:"127.0.0.1:%%p " >nul 2>nul
    if errorlevel 1 set PORT=%%p
  )
)
if not defined PORT set PORT=8787

echo   Adres: http://127.0.0.1:%PORT%/index.html
echo.
start "" "http://127.0.0.1:%PORT%/index.html"
python -m http.server %PORT% --bind 127.0.0.1 >nul 2>nul
