@echo off
cd /d "%~dp0"
title Neon Ball Battle - PHONE MODE (keep this window open)
echo.
echo  ==========================================================
echo   NEON BALL BATTLE game server - PHONE MODE
echo   Keep this window open while you play.
echo.
echo   1. Connect your phone to the SAME Wi-Fi as this PC.
echo   2. Look below for the line:  PHONE / TABLET on the same Wi-Fi
echo   3. Type the link under it in your phone browser.
echo.
echo   Use phone mode only on your HOME Wi-Fi.
echo   To stop the server: close this window.
echo  ==========================================================
echo.
if not exist package.json (
  echo  This file must be inside the NEON-BALL-BATTLE folder
  echo  next to index, package and server. Move it there and try again.
  echo.
  pause
  exit /b
)
set HOST=0.0.0.0
call npm start
pause
