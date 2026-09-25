@echo off
title HyperDrift 3D Server
cd /d "%~dp0"
echo Starting HyperDrift 3D Local Server...
start "" http://localhost:8000
py server.py
pause
