@echo off
setlocal
title Apex Grand Prix: Dedicated Server Host
cd /d "%~dp0\.."

echo =====================================================================
echo   APEX GRAND PRIX: 24/7 DEDICATED MULTIPLAYER SERVER HOST
echo =====================================================================
echo.
echo Starting dedicated Node.js server on port 8080...
echo.

node server/dedicated_server.mjs
if %ERRORLEVEL% neq 0 (
  echo.
  echo Server encountered an error. Restarting in 5 seconds...
  timeout /t 5
  goto loop
)

pause
