@echo off
cd /d "%~dp0"
title Neon Ball Battle - GAME SERVER (keep this window open)
echo.
echo  ==========================================================
echo   NEON BALL BATTLE game server
echo   Keep this window open while you play.
echo   The game opens in your browser at http://localhost:8080
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
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:8080"
call npm start
pause
