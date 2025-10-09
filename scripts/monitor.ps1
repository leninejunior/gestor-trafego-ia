# Script de Monitoramento Contínuo
# Monitora o sistema e reinicia automaticamente se necessário

param(
    [int]$IntervalSeconds = 30,
    [switch]$AutoRestart = $false
)

Write-Host "🔍 Monitor do Sistema Iniciado" -ForegroundColor Cyan
Write-Host "Intervalo: $IntervalSeconds segundos" -ForegroundColor Gray
Write-Host "Auto-restart: $AutoRestart" -ForegroundColor Gray
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Yellow
Write-Host ""

$iteration = 0

while ($true) {
    $iteration++
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$timestamp] Verificação #$iteration" -ForegroundColor Cyan
    
    # Verificar se Next.js está rodando
    $nextProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -like "*Next.js*" -or 
        $_.ProcessName -eq "node"
    }
    
    # Verificar porta 3000
    $port3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    
    # Status do sistema
    if ($port3000) {
        Write-Host "  ✅ Porta 3000: Ativa" -ForegroundColor Green
        
        # Testar conectividade HTTP
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "  ✅ HTTP: Respondendo (200 OK)" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  HTTP: Status $($response.StatusCode)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ❌ HTTP: Não responde" -ForegroundColor Red
            
            if ($AutoRestart) {
                Write-Host "  🔄 Reiniciando automaticamente..." -ForegroundColor Yellow
                & "$PSScriptRoot\restart-system.ps1"
                break
            }
        }
    } else {
        Write-Host "  ❌ Porta 3000: Inativa" -ForegroundColor Red
        
        if ($AutoRestart) {
            Write-Host "  🔄 Iniciando sistema..." -ForegroundColor Yellow
            Start-Process -FilePath "pnpm" -ArgumentList "run", "dev" -NoNewWindow
            Start-Sleep -Seconds 10
        }
    }
    
    # Verificar uso de CPU e memória
    if ($nextProcess) {
        $totalCPU = ($nextProcess | Measure-Object -Property CPU -Sum).Sum
        $totalMemory = ($nextProcess | Measure-Object -Property WorkingSet -Sum).Sum / 1MB
        
        Write-Host "  📊 CPU: $([math]::Round($totalCPU, 1))% | RAM: $([math]::Round($totalMemory, 1)) MB" -ForegroundColor Gray
        
        # Alerta se uso muito alto
        if ($totalMemory -gt 1000) {
            Write-Host "  ⚠️  Alto uso de memória!" -ForegroundColor Yellow
        }
    }
    
    # Verificar espaço em disco
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3 AND DeviceID='C:'"
    $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 1)
    
    if ($freeSpaceGB -lt 2) {
        Write-Host "  ⚠️  Pouco espaço em disco: $freeSpaceGB GB" -ForegroundColor Yellow
    }
    
    # Verificar se há arquivos .env
    if (-not (Test-Path ".env")) {
        Write-Host "  ⚠️  Arquivo .env não encontrado!" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Start-Sleep -Seconds $IntervalSeconds
}

Write-Host "Monitor finalizado." -ForegroundColor Gray