@echo off
chcp 65001 >nul
title Servidor de Desenvolvimento

echo.
echo 🚀 INICIANDO SERVIDOR DE DESENVOLVIMENTO
echo.

REM Matar processos na porta 3000
echo 🔪 Liberando porta 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING" 2^>nul') do (
    echo    Matando PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

REM Matar processos Node.js
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1

echo ✅ Porta liberada
timeout /t 1 >nul

REM Limpar cache Next.js rapidamente
if exist .next (
    rmdir /s /q .next >nul 2>&1
    echo ✅ Cache limpo
)

echo.
echo 🌟 Iniciando Next.js...
echo 🔗 http://localhost:3000
echo 📊 http://localhost:3000/dashboard
echo.

REM Iniciar diretamente com npm
npm run dev