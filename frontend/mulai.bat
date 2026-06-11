@echo off
title TOSM Dev Server
color 0A

echo.
echo  ================================================
echo    TOSM Local Server - Komponen Engine
echo  ================================================
echo.
echo  Memulai server di http://localhost:8080 ...
echo  Tutup window ini untuk menghentikan server.
echo.

:: Buka browser setelah 1.5 detik
start "" /B cmd /C "timeout /t 2 /nobreak >nul && start http://localhost:8080/assets/animations/Modul1/animasi-modul1.html"

:: Jalankan server
node server.cjs

pause
