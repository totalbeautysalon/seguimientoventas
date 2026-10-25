@echo off
title Total Beauty - Sincronizar con GitHub
color 0A
cd /d "%~dp0"

echo ======================================================
echo    TOTAL BEAUTY SALON Y ACADEMIA
echo    Sincronizacion de Repositorio con GitHub
echo ======================================================
echo.

:: Verificar si git esta disponible
where git >nul 2>nul
if errorlevel 1 (
    set "PATH=%PATH%;C:\Users\Marbella\AppData\Local\MinGit\cmd"
)

:: Configurar usuario si no esta configurado
git config user.name >nul 2>nul
if errorlevel 1 (
    git config user.name "Total Beauty Admin"
    git config user.email "totalbeautysalonacademia@gmail.com"
)

echo Preparando archivos...
git add .

echo.
set /p commit_msg="Mensaje del Commit (presione ENTER para mensaje por defecto): "
if "%commit_msg%"=="" (
    set commit_msg="Actualizacion Sistema Arqueo, Firebase, BalanceScore y Reportes"
)

git commit -m "%commit_msg%"

echo.
echo ======================================================
echo  Verificando configuracion de repositorio remoto GitHub...
echo ======================================================
git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo.
    echo No hay ningun repositorio remoto de GitHub configurado todavia.
    echo Ingrese la URL de su repositorio en GitHub:
    echo (Ejemplo: https://github.com/TU-USUARIO/arqueo-diario-caja.git)
    echo.
    set /p repo_url="URL de GitHub: "
    if not "%repo_url%"=="" (
        git remote add origin %repo_url%
        git branch -M main
        echo Subiendo a GitHub por primera vez...
        git push -u origin main
    ) else (
        echo Operacion cancelada. Puede configurar el repositorio mas tarde con:
        echo git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
        echo git push -u origin main
    )
) else (
    echo Subiendo cambios a GitHub en la rama main...
    git push origin main
)

echo.
echo ======================================================
echo  Proceso finalizado.
echo ======================================================
pause
