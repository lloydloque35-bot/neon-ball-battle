@echo off
cd /d "%~dp0"
title Neon Ball Battle - UPDATE
echo.
echo  ==========================================================
echo   NEON BALL BATTLE - download the latest version
echo   Your accounts and progress (the data folder) are kept.
echo   Close the black game server window BEFORE updating.
echo  ==========================================================
echo.
if not exist package.json (
  echo  This file must be inside the NEON-BALL-BATTLE folder
  echo  next to index, package and server. Move it there and try again.
  echo.
  pause
  exit /b
)
set "TMPD=%TEMP%\nbb-update"
if exist "%TMPD%" rmdir /s /q "%TMPD%"
mkdir "%TMPD%"
echo  Downloading...
curl -L --fail -s -o "%TMPD%\game.zip" https://github.com/lloydloque35-bot/neon-ball-battle/archive/refs/heads/main.zip
if errorlevel 1 goto fail
tar -xf "%TMPD%\game.zip" -C "%TMPD%"
if errorlevel 1 goto fail
if not exist "%TMPD%\neon-ball-battle-main\package.json" goto fail
echo  Copying the new files...
robocopy "%TMPD%\neon-ball-battle-main" "%CD%" /E /XD data node_modules .git /XF .env UPDATE-GAME.bat /NFL /NDL /NJH /NJS /NP
if errorlevel 8 goto fail
rmdir /s /q "%TMPD%"
echo.
echo  DONE! The game is updated. Your accounts and progress were not touched.
echo  Now start the game server again (START-GAME-SERVER-PHONE.bat).
echo.
pause
exit /b
:fail
echo.
echo  The update did not work. Check your internet connection and try again.
echo  Nothing in your game folder was deleted.
echo.
pause
