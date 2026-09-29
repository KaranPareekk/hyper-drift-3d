@echo off
title Hyper Drift 3D - Local Server
cd /d "%~dp0"
echo ========================================================
echo   STARTING HYPER DRIFT 3D RACING GAME...
echo ========================================================
py server.py --open
if %errorlevel% neq 0 (
    python server.py --open
)
pause
