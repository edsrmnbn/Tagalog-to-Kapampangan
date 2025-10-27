@echo off
title Translator Server
cd /d "%~dp0"

echo Starting Translator...
echo -----------------------
:: Run the Node.js server
node server.js

echo.
echo Translator stopped or closed.
pause
