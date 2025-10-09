# Script de Verificação do Sistema
# Verifica saúde do sistema sem reiniciar

Write-Host "🔍 Verificação do Sistema" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Função para verificar status
function Test-SystemComponent {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$SuccessMessage,
        [string]$FailMessage
    )
    
    try {
        $result = & $Test
        if ($result) {
            Write-Host "✅ $Name`: $SuccessMessage" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ $Name`: $FailMessage" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ $Name`: $FailMessage - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 1. Verificar Node.js
$nodeOk = Test-SystemComponent -Name "Node.js" -Test {
    $version = node --version 2>$null
    return $version
} -SuccessMessage "Instalado ($((node --version)))" -FailMessage "Não encontrado"

# 2. Verificar pnpm
$pnpmOk = Test-SystemComponent -Name "pnpm" -Test {
    $version = pnpm --version 2>$null
    return $version
} -SuccessMessage "Instalado ($((pnpm --version)))" -FailMessage "Não encontrado"

# 3. Verificar arquivos essenciais
$packageOk = Test-SystemComponent -Name "package.json" -Test {
    return Test-Path "package.json"
} -SuccessMessage "Encontrado" -FailMessage "Não encontrado"

$envOk = Test-SystemComponent -Name ".env" -Test {
    return Test-Path ".env"
} -SuccessMessage "Encontrado" -FailMessage "Não encontrado"

# 4. Verificar dependências instaladas
$nodeModulesOk = Test-SystemComponent -Name "node_modules" -Test {
    return Test-Path "node_modules"
} -SuccessMessage "Dependências instaladas" -FailMessage "Dependências não instaladas"

# 5. Verificar processos rodando
Write-Host ""
Write-Host "🔄 Processos Ativos:" -ForegroundColor Cyan

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "🟢 Node.js rodando ($($nodeProcesses.Count) processo(s))" -ForegroundColor Green
    foreach ($proc in $nodeProcesses) {
        Write-Host "   PID: $($proc.Id) - CPU: $($proc.CPU)%" -ForegroundColor Gray
    }
} else {
    Write-Host "🔴 Nenhum processo Node.js rodando" -ForegroundColor Yellow
}

# 6. Verificar portas
Write-Host ""
Write-Host "🌐 Status das Portas:" -ForegroundColor Cyan

$ports = @(3000, 3001, 5000)
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "🟢 Porta $port`: Ocupada (PID: $($connection.OwningProcess) - $($process.ProcessName))" -ForegroundColor Green
    } else {
        Write-Host "🔴 Porta $port`: Livre" -ForegroundColor Yellow
    }
}

# 7. Verificar espaço em disco
Write-Host ""
Write-Host "💾 Espaço em Disco:" -ForegroundColor Cyan

$disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3" | Where-Object { $_.DeviceID -eq "C:" }
$freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
$totalSpaceGB = [math]::Round($disk.Size / 1GB, 2)
$usedPercent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 1)

if ($freeSpaceGB -gt 5) {
    Write-Host "✅ Espaço livre: $freeSpaceGB GB de $totalSpaceGB GB ($usedPercent% usado)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Pouco espaço livre: $freeSpaceGB GB de $totalSpaceGB GB ($usedPercent% usado)" -ForegroundColor Yellow
}

# 8. Verificar cache
Write-Host ""
Write-Host "🗂️  Cache:" -ForegroundColor Cyan

if (Test-Path ".next") {
    $nextSize = (Get-ChildItem ".next" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "📁 Cache Next.js: $([math]::Round($nextSize, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "📁 Cache Next.js: Não encontrado" -ForegroundColor Gray
}

if (Test-Path "node_modules") {
    $nodeModulesSize = (Get-ChildItem "node_modules" -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "📦 node_modules: $([math]::Round($nodeModulesSize, 2)) MB" -ForegroundColor Gray
}

# 9. Resumo final
Write-Host ""
Write-Host "📊 Resumo:" -ForegroundColor Cyan
Write-Host "==========" -ForegroundColor Cyan

$allOk = $nodeOk -and $pnpmOk -and $packageOk -and $nodeModulesOk

if ($allOk) {
    Write-Host "🎉 Sistema está funcionando corretamente!" -ForegroundColor Green
    Write-Host "💡 Para iniciar: pnpm run dev" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Sistema precisa de atenção!" -ForegroundColor Yellow
    Write-Host "💡 Execute: .\scripts\restart-system.ps1" -ForegroundColor Cyan
}

if (-not $envOk) {
    Write-Host "🔧 Lembre-se de configurar as variáveis de ambiente no .env" -ForegroundColor Yellow
}

Write-Host ""