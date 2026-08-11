@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Fast Cesto requires Node.js 20 or newer for this internal Alpha.
  echo Install Node.js, then run this launcher again.
  pause
  exit /b 1
)
node.exe -e "if (Number(process.versions.node.split('.')[0]) < 20) process.exit(1)"
if errorlevel 1 (
  echo Fast Cesto requires Node.js 20 or newer. Please update Node.js.
  pause
  exit /b 1
)
node.exe tools\fast-cesto-ui.mjs
if errorlevel 1 pause
