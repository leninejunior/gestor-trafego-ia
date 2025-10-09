@echo off
chcp 65001 >nul
title Reinicializacao Simples

echo.
echo === REINICIALIZACAO SIMPLES ===
echo.

echo [1/4] Finalizando processos...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im pnpm.exe >nul 2>&1

echo [2/4] Liberando porta 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [3/4] Limpando cache...
if exist .next rmdir /s /q .next >nul 2>&1

echo [4/4] Iniciando sistema...
echo.
echo Acesse: http://localhost:3000
echo.

pnpm run dev