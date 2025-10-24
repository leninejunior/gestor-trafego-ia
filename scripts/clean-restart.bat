@echo off
echo Limpando e reiniciando sistema...

REM Finalizar processos Node.js
echo Finalizando processos...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im pnpm.exe >nul 2>&1

REM Liberar porta 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

REM Limpar cache Next.js
if exist .next (
    rmdir /s /q .next >nul 2>&1
    echo Cache limpo.
)

echo Sistema limpo. Iniciando servidor...
echo.

REM Iniciar servidor
npm run dev