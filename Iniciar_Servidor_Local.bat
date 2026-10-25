@echo off
title Servidor Local - Arqueo de Caja Total Beauty
color 0B
cd /d "%~dp0"

echo ======================================================
echo    Iniciando Servidor Web Local para Arqueo de Caja...
echo ======================================================
echo.

python server.py

if errorlevel 1 (
    echo.
    echo No se pudo iniciar con Python, abriendo directamente archivo local...
    start "" "%~dp0index.html"
)

pause
