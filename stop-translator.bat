@echo off
title Stop Translator Server
echo Stopping all running Node.js translator servers...
taskkill /f /im node.exe
echo.
echo ✅ Translator stopped successfully.
pause
