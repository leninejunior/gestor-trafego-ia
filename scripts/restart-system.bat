@echo off
chcp 65001 >nul
title Sistema de Reinicialização

echo.
echo 🔄 Iniciando reinicialização do sistema...
echo.

REM 1. Matar processos existentes
echo 🔪 Matando processos existentes...

REM Matar processos Node.js
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im pnpm.exe >nul 2>&1
taskkill /f /im yarn.exe >nul 2>&1

REM Matar processos por porta
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo    Matando processo PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
    echo    Matando processo PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

echo ✅ Processos finalizados
timeout /t 3 >nul

REM 2. Verificar dependências
echo.
echo 🔍 Verificando dependências...

REM Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado!
    pause
    exit /b 1
) else (
    for /f %%i in ('node --version') do echo ✅ Node.js: %%i
)

REM Verificar pnpm
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ pnpm não encontrado!
    echo 💡 Instalando pnpm...
    npm install -g pnpm
) else (
    for /f %%i in ('pnpm --version') do echo ✅ pnpm: %%i
)

REM Verificar arquivos essenciais
if exist package.json (
    echo ✅ package.json encontrado
) else (
    echo ❌ package.json não encontrado!
    pause
    exit /b 1
)

if exist .env (
    echo ✅ .env encontrado
) else (
    echo ⚠️  .env não encontrado
    if exist env.exemple (
        copy env.exemple .env >nul
        echo ✅ .env criado a partir de env.exemple
    ) else (
        echo ❌ env.exemple também não encontrado!
    )
)

REM 3. Limpar cache
echo.
echo 🧹 Limpando cache...

REM Limpar cache do pnpm
pnpm store prune >nul 2>&1
echo ✅ Cache do pnpm limpo

REM Limpar cache do Next.js
if exist .next (
    rmdir /s /q .next >nul 2>&1
    echo ✅ Cache do Next.js limpo
)

REM Perguntar sobre reinstalação
echo.
set /p reinstall="🤔 Deseja reinstalar dependências? (s/N): "
if /i "%reinstall%"=="s" (
    echo 🗑️  Removendo node_modules...
    if exist node_modules (
        rmdir /s /q node_modules >nul 2>&1
    )
    
    echo 📦 Instalando dependências...
    pnpm install
    
    if %errorlevel% equ 0 (
        echo ✅ Dependências instaladas com sucesso
    ) else (
        echo ❌ Erro ao instalar dependências!
        pause
        exit /b 1
    )
)

REM 4. Verificar build
echo.
echo 🔨 Verificando build...
pnpm run build >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Build realizado com sucesso
) else (
    echo ⚠️  Erro no build, mas continuando...
)

REM 5. Iniciar sistema
echo.
echo 🚀 Iniciando o sistema...

REM Verificar porta 3000 novamente
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo ⚠️  Porta 3000 ainda ocupada, liberando...
    taskkill /f /pid %%a >nul 2>&1
    timeout /t 2 >nul
)

echo.
echo 🌟 Sistema reiniciado com sucesso!
echo 🔗 Acesse: http://localhost:3000
echo 📊 Dashboard: http://localhost:3000/dashboard
echo.
echo ▶️  Iniciando servidor de desenvolvimento...
echo.

REM Iniciar em modo desenvolvimento
pnpm run dev