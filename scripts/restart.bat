@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Restart - Ads Manager

echo.
echo ========================================
echo    RESTART - ADS MANAGER PLATFORM
echo ========================================
echo.

REM Verificar se estamos no diretório correto
if not exist package.json (
    echo ERRO: Execute este script a partir da raiz do projeto!
    pause
    exit /b 1
)

echo [1/5] Finalizando processos Node.js...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im pnpm.exe >nul 2>&1
taskkill /f /im yarn.exe >nul 2>&1

echo [2/5] Liberando porta 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [3/5] Limpando cache Next.js...
if exist .next (
    rmdir /s /q .next >nul 2>&1
)

echo [4/5] Detectando package manager...

REM Detectar package manager
set PACKAGE_MANAGER=npm
if exist pnpm-lock.yaml (
    pnpm --version >nul 2>&1
    if !errorlevel! equ 0 (
        set PACKAGE_MANAGER=pnpm
    )
)

if exist yarn.lock (
    if "!PACKAGE_MANAGER!"=="npm" (
        yarn --version >nul 2>&1
        if !errorlevel! equ 0 (
            set PACKAGE_MANAGER=yarn
        )
    )
)

echo Package manager detectado: !PACKAGE_MANAGER!

echo.
echo [5/5] Iniciando servidor de desenvolvimento...
echo.
echo ========================================
echo  Servidor iniciando em:
echo  http://localhost:3000
echo.
echo  Rotas principais:
echo  - Dashboard: /dashboard
echo  - Admin: /admin
echo  - Checkout: /checkout
echo ========================================
echo.

timeout /t 2 >nul

REM Iniciar servidor
if "!PACKAGE_MANAGER!"=="pnpm" (
    pnpm dev
) else if "!PACKAGE_MANAGER!"=="yarn" (
    yarn dev
) else (
    npm run dev
)