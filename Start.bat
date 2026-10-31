@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.13 or later is required. Please install Node.js LTS.
  pause
  exit /b 1
)
node --no-warnings launcher.mjs
if errorlevel 1 pause
