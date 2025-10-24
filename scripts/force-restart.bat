@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Force Restart - Ads Manager

echo.
echo ========================================
echo    FORCE RESTART - ADS MANAGER
echo ========================================
echo.

REM Verificar se estamos no diretório correto
if not exist package.json (
    echo ERRO: Execute este script a partir da raiz do projeto!
    pause
    exit /b 1
)

echo [1/6] Finalizando TODOS os processos Node.js...

REM Matar TODOS os processos Node.js de forma mais agressiva
wmic process where "name='node.exe'" delete >nul 2>&1
wmic process where "name='npm.exe'" delete >nul 2>&1
wmic process where "name='pnpm.exe'" delete >nul 2>&1
wmic process where "name='yarn.exe'" delete >nul 2>&1

REM Método alternativo para matar processos
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im pnpm.exe >nul 2>&1
taskkill /f /im yarn.exe >nul 2>&1

echo [2/6] Liberando portas...

REM Liberar portas específicas
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING" 2^>nul') do (
    echo Liberando porta 3000 (PID: %%a)
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING" 2^>nul') do (
    echo Liberando porta 3001 (PID: %%a)
    taskkill /f /pid %%a >nul 2>&1
)

echo [3/6] Limpando caches...

REM Limpar cache Next.js
if exist .next (
    rmdir /s /q .next >nul 2>&1
    echo Cache Next.js removido
)

REM Limpar outros caches
if exist .tsbuildinfo (
    del .tsbuildinfo >nul 2>&1
    echo Cache TypeScript removido
)

del *.log >nul 2>&1

echo [4/6] Detectando package manager...

REM Detectar package manager
set PACKAGE_MANAGER=npm
if exist pnpm-lock.yaml (
    pnpm --version >nul 2>&1
    if !errorlevel! equ 0 (
        set PACKAGE_MANAGER=pnpm
        echo Usando pnpm
    ) else (
        echo pnpm-lock.yaml encontrado mas pnpm nao instalado, usando npm
    )
) else if exist yarn.lock (
    yarn --version >nul 2>&1
    if !errorlevel! equ 0 (
        set PACKAGE_MANAGER=yarn
        echo Usando yarn
    ) else (
        echo yarn.lock encontrado mas yarn nao instalado, usando npm
    )
) else (
    echo Usando npm (padrao)
)

echo [5/6] Verificando dependencias...

REM Verificar se node_modules existe
if not exist node_modules (
    echo node_modules nao encontrado, instalando dependencias...
    if "%PACKAGE_MANAGER%"=="pnpm" (
        call pnpm install
    ) else if "%PACKAGE_MANAGER%"=="yarn" (
        call yarn install
    ) else (
        call npm install
    )
    
    if !errorlevel! neq 0 (
        echo ERRO: Falha ao instalar dependencias!
        pause
        exit /b 1
    )
) else (
    echo Dependencias ja instaladas
)

echo [6/6] Iniciando servidor...

echo.
echo ========================================
echo  SERVIDOR INICIANDO...
echo.
echo  URLs de Acesso:
echo  - Frontend: http://localhost:3000
echo  - Dashboard: http://localhost:3000/dashboard
echo  - Admin: http://localhost:3000/admin
echo ========================================
echo.

REM Aguardar um momento para garantir que tudo foi limpo
timeout /t 3 >nul

REM Iniciar servidor com call para garantir execução
if "%PACKAGE_MANAGER%"=="pnpm" (
    echo Executando: pnpm run dev
    echo.
    call pnpm run dev
) else if "%PACKAGE_MANAGER%"=="yarn" (
    echo Executando: yarn dev
    echo.
    call yarn dev
) else (
    echo Executando: npm run dev
    echo.
    call npm run dev
)

REM Se chegou aqui, algo deu errado
echo.
echo ERRO: O servidor nao iniciou corretamente!
echo Verifique se ha erros acima.
pause