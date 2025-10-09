# Script de Reinicializacao do Sistema
# Mata processos, verifica dependencias e reinicia o sistema

Write-Host "Iniciando reinicializacao do sistema..." -ForegroundColor Cyan

# Funcao para verificar se um processo esta rodando
function Test-ProcessRunning {
    param([string]$ProcessName)
    return Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
}

# Funcao para matar processos por porta
function Stop-ProcessByPort {
    param([int]$Port)
    try {
        $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($process) {
            Write-Host "Matando processo na porta $Port (PID: $process)" -ForegroundColor Yellow
            Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    } catch {
        Write-Host "Nenhum processo encontrado na porta $Port" -ForegroundColor Gray
    }
}

# 1. Matar processos do Next.js e Node
Write-Host "Matando processos existentes..." -ForegroundColor Yellow

# Matar processos por nome
$processesToKill = @("node", "next", "npm", "pnpm", "yarn")
foreach ($proc in $processesToKill) {
    $runningProcs = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($runningProcs) {
        Write-Host "   Matando processos: $proc" -ForegroundColor Red
        $runningProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

# Matar processos por porta (Next.js padrao: 3000)
Stop-ProcessByPort -Port 3000
Stop-ProcessByPort -Port 3001
Stop-ProcessByPort -Port 5000

Write-Host "Processos finalizados" -ForegroundColor Green
Start-Sleep -Seconds 3

# 2. Verificar dependencias
Write-Host "Verificando dependencias..." -ForegroundColor Cyan

# Verificar Node.js
try {
    $nodeVersion = node --version
    Write-Host "Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js nao encontrado!" -ForegroundColor Red
    exit 1
}

# Verificar pnpm
try {
    $pnpmVersion = pnpm --version
    Write-Host "pnpm: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "pnpm nao encontrado!" -ForegroundColor Red
    Write-Host "Instalando pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
}

# Verificar se existe package.json
if (Test-Path "package.json") {
    Write-Host "package.json encontrado" -ForegroundColor Green
} else {
    Write-Host "package.json nao encontrado!" -ForegroundColor Red
    exit 1
}

# Verificar se existe .env
if (Test-Path ".env") {
    Write-Host ".env encontrado" -ForegroundColor Green
} else {
    Write-Host ".env nao encontrado, copiando de env.exemple..." -ForegroundColor Yellow
    if (Test-Path "env.exemple") {
        Copy-Item "env.exemple" ".env"
        Write-Host ".env criado a partir de env.exemple" -ForegroundColor Green
    } else {
        Write-Host "env.exemple tambem nao encontrado!" -ForegroundColor Red
    }
}

# 3. Limpar cache e reinstalar dependencias
Write-Host "Limpando cache..." -ForegroundColor Cyan

# Limpar cache do pnpm
pnpm store prune
Write-Host "Cache do pnpm limpo" -ForegroundColor Green

# Limpar cache do Next.js
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "Cache do Next.js limpo" -ForegroundColor Green
}

# Limpar node_modules se necessario
$reinstall = Read-Host "Deseja reinstalar dependencias? (s/N)"
if ($reinstall -eq "s" -or $reinstall -eq "S") {
    Write-Host "Removendo node_modules..." -ForegroundColor Yellow
    if (Test-Path "node_modules") {
        Remove-Item -Recurse -Force "node_modules"
    }
    
    Write-Host "Instalando dependencias..." -ForegroundColor Cyan
    pnpm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Dependencias instaladas com sucesso" -ForegroundColor Green
    } else {
        Write-Host "Erro ao instalar dependencias!" -ForegroundColor Red
        exit 1
    }
}

# 4. Verificar build
Write-Host "Verificando build..." -ForegroundColor Cyan
pnpm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build realizado com sucesso" -ForegroundColor Green
} else {
    Write-Host "Erro no build, mas continuando..." -ForegroundColor Yellow
}

# 5. Iniciar o sistema
Write-Host "Iniciando o sistema..." -ForegroundColor Cyan

# Verificar se a porta 3000 esta livre
$portCheck = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "Porta 3000 ainda ocupada, tentando liberar..." -ForegroundColor Yellow
    Stop-ProcessByPort -Port 3000
    Start-Sleep -Seconds 2
}

Write-Host "Sistema reiniciado com sucesso!" -ForegroundColor Green
Write-Host "Acesse: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Dashboard: http://localhost:3000/dashboard" -ForegroundColor Cyan

# Iniciar em modo desenvolvimento
Write-Host "Iniciando servidor de desenvolvimento..." -ForegroundColor Green
pnpm run dev