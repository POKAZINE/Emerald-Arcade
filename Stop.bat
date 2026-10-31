@echo off
cd /d "%~dp0"
node --no-warnings stop.mjs
if errorlevel 1 pause
