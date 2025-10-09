# Script de Reinicializacao Simples
Write-Host "=== REINICIALIZACAO SIMPLES ===" -ForegroundColor Cyan
Write-Host ""

# 1. Finalizar processos
Write-Host "[1/4] Finalizando processos..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "npm" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "pnpm" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Liberar porta 3000
Write-Host "[2/4] Liberando porta 3000..." -ForegroundColor Yellow
$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# 3. Limpar cache
Write-Host "[3/4] Limpando cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
}

# 4. Iniciar sistema
Write-Host "[4/4] Iniciando sistema..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Acesse: http://localhost:3000" -ForegroundColor Green
Write-Host ""

# Aguardar um pouco
Start-Sleep -Seconds 2

# Iniciar
pnpm run dev