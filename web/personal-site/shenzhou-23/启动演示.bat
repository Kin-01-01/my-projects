@echo off
rem One-click launcher: ES modules cannot load from file://, so we must
rem serve the site over local HTTP. This script starts serve.py if it is
rem not already running, then opens the browser.
rem 加固版：若 8123 端口被"僵死进程"占用（HTTP 无响应），先清理再启动，
rem 避免出现"端口在监听但页面打不开"的情况。
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8123

rem -- 1) 端口是否在监听？ --
netstat -ano | findstr /r /c:"127.0.0.1:%PORT% .*LISTENING" >nul 2>&1
if errorlevel 1 goto start_server

rem -- 2) 在监听：HTTP 是否响应？ --
curl -s -o nul -m 3 http://127.0.0.1:%PORT%/ >nul 2>&1
if %errorlevel%==0 goto open

rem -- 3) 在监听但无响应 = 僵死进程：结束它再重启 --
echo [!] 检测到 %PORT% 端口的服务器无响应，正在清理僵死进程...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"127.0.0.1:%PORT% .*LISTENING"') do taskkill /PID %%p /F >nul 2>&1
timeout /t 1 /nobreak >nul

:start_server
start "shenzhou-serve" /min python serve.py %PORT%
echo [*] 正在启动本地服务器 http://127.0.0.1:%PORT%/ ...
rem 等待服务器就绪（最多 10 秒）
for /l %%i in (1,1,10) do (
  timeout /t 1 /nobreak >nul
  curl -s -o nul -m 2 http://127.0.0.1:%PORT%/ >nul 2>&1
  if not errorlevel 1 goto open
)
echo [!] 服务器启动失败，请确认已安装 Python 并在本目录下手动执行: python serve.py
pause
exit

:open
start "" http://127.0.0.1:%PORT%/
exit
