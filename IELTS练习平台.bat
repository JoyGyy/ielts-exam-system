@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

:: 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo =========================================
    echo   需要先安装 Node.js
    echo   请访问: https://nodejs.org
    echo   下载 LTS 版本并安装
    echo   安装完成后重新双击此文件
    echo =========================================
    echo.
    pause
    exit /b 1
)

:: 首次运行时安装依赖
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    npm install --production >nul 2>&1
)

:: 启动服务器
echo 正在启动 IELTS 练习平台...
node server.cjs
pause
