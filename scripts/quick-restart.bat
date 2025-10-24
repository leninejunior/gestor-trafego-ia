@echo off
chcp 65001 >nul
title Restart Rápido - Ads Manager

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    ⚡ QUICK RESTART                          ║
echo ║                   Ads Manager Platform                       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Verificar diretório
if not exist package.json (
    echo ❌ Execute a partir da raiz do projeto!
    pause
    exit /b 1
)

REM Finalizar processos rapidamente
echo 🔪 Finalizando processos...

REM Matar processos Node.js
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| find "node.exe"') do (
    set "pid=%%i"
    set "pid=!pid:"=!"
    taskkill /f /pid !pid! >nul 2>&1
)

REM Matar outros processos
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im pnpm.exe >nul 2>&1
taskkill /f /im yarn.exe >nul 2>&1

REM Liberar porta 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo ✅ Processos finalizados

REM Limpar cache Next.js
if exist .next (
    rmdir /s /q .next >nul 2>&1
    echo ✅ Cache Next.js limpo
)

REM Detectar package manager
set PACKAGE_MANAGER=npm
if exist pnpm-lock.yaml (
    pnpm --version >nul 2>&1
    if !errorlevel! equ 0 (
        set PACKAGE_MANAGER=pnpm
    )
) else if exist yarn.lock (
    yarn --version >nul 2>&1
    if !errorlevel! equ 0 (
        set PACKAGE_MANAGER=yarn
    )
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  🚀 Reiniciando servidor...                                  ║
echo ║                                                              ║
echo ║  🔗 Acesse: http://localhost:3000                            ║
echo ║  📊 Dashboard: http://localhost:3000/dashboard               ║
echo ║  ⚙️  Admin: http://localhost:3000/admin                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Aguardar um momento
timeout /t 1 >nul

REM Iniciar com package manager detectado
if "%PACKAGE_MANAGER%"=="pnpm" (
    echo ▶️  Executando: pnpm run dev
    pnpm run dev
) else if "%PACKAGE_MANAGER%"=="yarn" (
    echo ▶️  Executando: yarn dev
    yarn dev
) else (
    echo ▶️  Executando: npm run dev
    npm run dev
)