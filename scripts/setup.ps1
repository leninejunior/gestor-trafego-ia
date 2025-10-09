# Script de Configuração Inicial do Sistema
# Configura o ambiente pela primeira vez

Write-Host "🚀 Configuração Inicial do Sistema" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar pré-requisitos
Write-Host "🔍 Verificando pré-requisitos..." -ForegroundColor Cyan

# Verificar Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js não encontrado!" -ForegroundColor Red
    Write-Host "💡 Instale Node.js em: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Verificar Git
try {
    $gitVersion = git --version
    Write-Host "✅ Git encontrado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Git não encontrado (opcional)" -ForegroundColor Yellow
}

# 2. Instalar pnpm se necessário
Write-Host ""
Write-Host "📦 Configurando gerenciador de pacotes..." -ForegroundColor Cyan

try {
    $pnpmVersion = pnpm --version
    Write-Host "✅ pnpm já instalado: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "💡 Instalando pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ pnpm instalado com sucesso" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro ao instalar pnpm!" -ForegroundColor Red
        exit 1
    }
}

# 3. Configurar arquivo .env
Write-Host ""
Write-Host "⚙️  Configurando variáveis de ambiente..." -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    if (Test-Path "env.exemple") {
        Copy-Item "env.exemple" ".env"
        Write-Host "✅ Arquivo .env criado a partir de env.exemple" -ForegroundColor Green
        Write-Host "🔧 IMPORTANTE: Configure as variáveis no arquivo .env" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Arquivo env.exemple não encontrado!" -ForegroundColor Red
    }
} else {
    Write-Host "✅ Arquivo .env já existe" -ForegroundColor Green
}

# 4. Instalar dependências
Write-Host ""
Write-Host "📚 Instalando dependências..." -ForegroundColor Cyan

pnpm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependências instaladas com sucesso" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao instalar dependências!" -ForegroundColor Red
    exit 1
}

# 5. Verificar build
Write-Host ""
Write-Host "🔨 Testando build..." -ForegroundColor Cyan

pnpm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build realizado com sucesso" -ForegroundColor Green
} else {
    Write-Host "⚠️  Erro no build - verifique configurações" -ForegroundColor Yellow
}

# 6. Configurar banco de dados
Write-Host ""
Write-Host "🗄️  Configuração do Banco de Dados" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Próximos passos para o Supabase:" -ForegroundColor Yellow
Write-Host "1. Acesse: https://supabase.com/" -ForegroundColor White
Write-Host "2. Crie um novo projeto" -ForegroundColor White
Write-Host "3. Execute o SQL em: database/meta-ads-schema.sql" -ForegroundColor White
Write-Host "4. Configure as variáveis SUPABASE no .env" -ForegroundColor White
Write-Host ""

# 7. Configurar Meta Ads
Write-Host "📱 Configuração do Meta Ads" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Próximos passos para Meta Ads:" -ForegroundColor Yellow
Write-Host "1. Acesse: https://developers.facebook.com/" -ForegroundColor White
Write-Host "2. Crie um novo app" -ForegroundColor White
Write-Host "3. Adicione o produto 'Marketing API'" -ForegroundColor White
Write-Host "4. Configure as variáveis META no .env" -ForegroundColor White
Write-Host "5. Adicione callback URL: http://localhost:3000/api/meta/callback" -ForegroundColor White
Write-Host ""

# 8. Resumo final
Write-Host "🎉 Configuração Inicial Concluída!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Arquivos importantes criados:" -ForegroundColor Cyan
Write-Host "   • .env (configure suas variáveis)" -ForegroundColor White
Write-Host "   • node_modules/ (dependências)" -ForegroundColor White
Write-Host "   • scripts/ (scripts de automação)" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Scripts disponíveis:" -ForegroundColor Cyan
Write-Host "   • .\scripts\restart-system.ps1    - Reinicialização completa" -ForegroundColor White
Write-Host "   • .\scripts\quick-restart.bat     - Reinicialização rápida" -ForegroundColor White
Write-Host "   • .\scripts\system-check.ps1      - Verificação do sistema" -ForegroundColor White
Write-Host ""
Write-Host "▶️  Para iniciar o sistema:" -ForegroundColor Green
Write-Host "   pnpm run dev" -ForegroundColor White
Write-Host ""
Write-Host "🌐 URLs importantes:" -ForegroundColor Cyan
Write-Host "   • http://localhost:3000           - Aplicação" -ForegroundColor White
Write-Host "   • http://localhost:3000/dashboard - Dashboard" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentação:" -ForegroundColor Cyan
Write-Host "   • docs/META_INTEGRATION.md        - Guia de integração Meta" -ForegroundColor White
Write-Host ""

$startNow = Read-Host "🚀 Deseja iniciar o sistema agora? (s/N)"
if ($startNow -eq "s" -or $startNow -eq "S") {
    Write-Host ""
    Write-Host "🌟 Iniciando sistema..." -ForegroundColor Green
    pnpm run dev
}