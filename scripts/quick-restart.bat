@echo off
chcp 65001 >nul
title Reinicialização Rápida

echo.
echo ⚡ Reinicialização Rápida do Sistema
echo.

REM Matar processos rapidamente
echo 🔪 Finalizando processos...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im pnpm.exe >nul 2>&1

REM Matar por porta 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo ✅ Processos finalizados
timeout /t 2 >nul

REM Limpar cache Next.js
if exist .next (
    rmdir /s /q .next >nul 2>&1
    echo ✅ Cache limpo
)

echo.
echo 🚀 Reiniciando...
echo 🔗 http://localhost:3000
echo.

REM Iniciar
pnpm run dev