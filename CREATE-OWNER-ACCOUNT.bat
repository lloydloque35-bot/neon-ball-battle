@echo off
cd /d "%~dp0"
title Neon Ball Battle - Create OWNER account
echo.
echo  ==========================================================
echo   NEON BALL BATTLE - create your OWNER (admin) account
echo  ==========================================================
echo.
if not exist package.json (
  echo  This file must be inside the NEON-BALL-BATTLE folder
  echo  next to index, package and server. Move it there and try again.
  echo.
  pause
  exit /b
)
set /p NBB_USER=  Type your owner username (letters and numbers only) and press Enter: 
echo.
echo  Next it asks for a password. NOTHING appears while you type - that is normal.
echo.
call npm run owner -- create --username %NBB_USER%
echo.
echo  Finished. You can close this window.
pause
