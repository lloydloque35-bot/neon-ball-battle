@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Neon Ball Battle - PHONE MODE (keep this window open)
echo.
echo  ==========================================================
echo   NEON BALL BATTLE game server - PHONE MODE
echo   Keep this window open while you play.
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
echo  The phone link appears below when the server has started.
echo.
set HOST=0.0.0.0
call npm start
pause
