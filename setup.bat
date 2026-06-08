@echo off
echo.
echo   Tijori Finance MCP — Setup
echo   ===========================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: Node.js is not installed.
    echo.
    echo   Download and install Node.js from:
    echo   https://nodejs.org  ^(choose the LTS version^)
    echo.
    echo   Then double-click this file again.
    echo.
    pause
    exit /b 1
)

node setup.js
echo.
pause
