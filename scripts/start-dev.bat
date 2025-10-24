@echo off
chcp 65001 >nul
title Desenvolvimento Rápido - Ads Manager

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    ⚡ QUICK START                            ║
echo ║                   Ads Manager Platform                       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Verificar se estamos no diretório correto
if not exist package.json (
    echo ❌ Erro: Execute este script a partir da raiz do projeto.
    pause
    exit /b 1
)

REM Liberar porta 3000 rapidamente
echo 🔪 Liberando porta 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

REM Finalizar processos Node.js antigos
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im pnpm.exe >nul 2>&1

echo ✅ Processos finalizados

REM Limpar cache Next.js se necessário
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
echo ║  🚀 Iniciando servidor de desenvolvimento...                 ║
echo ║                                                              ║
echo ║  🔗 URLs:                                                    ║
echo ║     • http://localhost:3000                                  ║
echo ║     • http://localhost:3000/dashboard                        ║
echo ║     • http://localhost:3000/admin                            ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Aguardar um momento
timeout /t 1 >nul

REM Iniciar com o package manager detectado
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