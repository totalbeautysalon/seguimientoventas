@echo off
title Total Beauty - Arqueo Diario de Caja
color 0D
cd /d "%~dp0"

echo ======================================================
echo    TOTAL BEAUTY SALON Y ACADEMIA
echo    Sistema de Arqueo Diario de Caja
echo ======================================================
echo.
echo Abriendo aplicacion interactiva de arqueo de caja...
echo.

:: Intentar abrir en modo App de Microsoft Edge (experiencia limpia tipo app nativa)
start msedge.exe --app="%~dp0index.html" --start-maximized 2>nul

if errorlevel 1 (
    :: Si Edge no esta disponible o fallo, abrir en navegador predeterminado
    start "" "%~dp0index.html"
)

exit
