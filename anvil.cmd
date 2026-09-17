@echo off
setlocal
cd /d "%~dp0"
where pnpm >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node 22+ 和 pnpm。
  exit /b 1
)
if not exist node_modules (
  call pnpm install
)
echo 打开 http://127.0.0.1:5173
call pnpm dev
