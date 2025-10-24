@echo off
chcp 65001 >nul
title Dev Server - Ads Manager

echo.
echo ========================================
echo    INICIANDO SERVIDOR DE DESENVOLVIMENTO
echo ========================================
echo.

REM Verificar se estamos no diretório correto
if not exist package.json (
    echo ERRO: Execute este script a partir da raiz do projeto!
    pause
    exit /b 1
)

echo Finalizando processos Node.js...
taskkill /f /im node.exe >nul 2>&1

echo Liberando porta 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Limpando cache Next.js...
if exist .next rmdir /s /q .next >nul 2>&1

echo.
echo Detectando package manager...

REM Detectar package manager
if exist pnpm-lock.yaml (
    pnpm --version >nul 2>&1
    if !errorlevel! equ 0 (
        echo Usando pnpm
        echo.
        echo Iniciando servidor em http://localhost:3000
        echo.
        pnpm dev
        goto :end
    )
)

if exist yarn.lock (
    yarn --version >nul 2>&1
    if !errorlevel! equ 0 (
        echo Usando yarn
        echo.
        echo Iniciando servidor em http://localhost:3000
        echo.
        yarn dev
        goto :end
    )
)

echo Usando npm
echo.
echo Iniciando servidor em http://localhost:3000
echo.
npm run dev

:end