Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   RESTART COMPLETO - NEXT.JS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Matar todos os processos Node.js
Write-Host "[1/5] Finalizando processos Node.js..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 2. Liberar porta 3000
Write-Host "[2/5] Liberando porta 3000..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    $processId = $port3000.OwningProcess
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

# 3. Limpar cache Next.js
Write-Host "[3/5] Limpando cache Next.js..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

# 4. Limpar cache Turbopack
Write-Host "[4/5] Limpando cache Turbopack..." -ForegroundColor Yellow
if (Test-Path "node_modules/.cache") {
    Remove-Item -Path "node_modules/.cache" -Recurse -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

# 5. Iniciar servidor
Write-Host "[5/5] Iniciando servidor..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Servidor iniciando em http://localhost:3000" -ForegroundColor Green
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Gray
Write-Host ""

pnpm dev
