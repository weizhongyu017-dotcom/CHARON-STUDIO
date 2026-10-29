@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=5173

where py >nul 2>&1 && set "PY=py"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY (
  echo 未找到 Python，无法启动预览。
  pause
  exit /b 1
)

REM Kill anything already listening on the port (PID is last column)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  taskkill /F /PID %%P >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo 正在启动 CHARON STUDIO ...
REM Use cmd /c so args are not eaten by START's title parsing
start "CHARON-STUDIO-SERVER" /MIN cmd /c ""%PY%" -m http.server %PORT% --bind 127.0.0.1"

set /a tries=0
:wait
set /a tries+=1
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ne 200) { exit 1 }; if ($r.Content.Length -lt 50) { exit 1 }; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto ready
if %tries% GEQ 25 (
  echo.
  echo 启动失败：http://127.0.0.1:%PORT%/ 无有效响应。
  echo 请把本窗口内容截图发我。
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait

:ready
start "" "http://127.0.0.1:%PORT%/#/"
echo.
echo 已打开 http://127.0.0.1:%PORT%/#/
echo 请保持标题为 CHARON-STUDIO-SERVER 的窗口运行；关掉它预览就会停。
echo.
pause
