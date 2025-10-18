# Script consolidado para corrigir todos os problemas
# Execute este script para ver todas as correções necessárias

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CORREÇÃO COMPLETA DO SISTEMA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Este script irá guiá-lo através de todas as correções necessárias." -ForegroundColor White
Write-Host ""

Write-Host "PROBLEMAS IDENTIFICADOS:" -ForegroundColor Red
Write-Host "1. Tabela memberships sem coluna org_id" -ForegroundColor Yellow
Write-Host "2. Erro ao buscar cliente após conectar Meta" -ForegroundColor Yellow
Write-Host "3. API /api/user/info com colunas incorretas" -ForegroundColor Yellow
Write-Host "4. Usuários sem organização" -ForegroundColor Yellow
Write-Host ""

Write-Host "CORREÇÕES APLICADAS NO CÓDIGO:" -ForegroundColor Green
Write-Host "✓ src/app/dashboard/clients/actions.ts" -ForegroundColor White
Write-Host "✓ src/app/dashboard/clients/[clientId]/page.tsx" -ForegroundColor White
Write-Host "✓ src/app/api/user/info/route.ts" -ForegroundColor White
Write-Host "✓ src/components/dashboard/sidebar-user-info.tsx" -ForegroundColor White
Write-Host ""

Write-Host "SCRIPTS SQL A EXECUTAR:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣  DIAGNÓSTICO (Execute primeiro)" -ForegroundColor Yellow
Write-Host "   Arquivo: database/diagnose-system.sql" -ForegroundColor White
Write-Host "   Objetivo: Identificar o estado atual do sistema" -ForegroundColor Gray
Write-Host ""

Write-Host "2️⃣  CORRIGIR MEMBERSHIPS" -ForegroundColor Yellow
Write-Host "   Arquivo: database/fix-memberships-table.sql" -ForegroundColor White
Write-Host "   Objetivo: Adicionar coluna org_id e criar organizações" -ForegroundColor Gray
Write-Host ""

Write-Host "3️⃣  CORRIGIR RLS DE CLIENTS" -ForegroundColor Yellow
Write-Host "   Arquivo: database/fix-clients-rls.sql" -ForegroundColor White
Write-Host "   Objetivo: Configurar políticas de acesso corretas" -ForegroundColor Gray
Write-Host ""

Write-Host "4️⃣  CONFIGURAR AUTOMAÇÃO" -ForegroundColor Yellow
Write-Host "   Arquivo: database/setup-auto-organization.sql" -ForegroundColor White
Write-Host "   Objetivo: Criar trigger para novos usuários" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COMO EXECUTAR" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Acesse: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "2. Selecione seu projeto" -ForegroundColor White
Write-Host "3. Vá em 'SQL Editor' no menu lateral" -ForegroundColor White
Write-Host "4. Execute os scripts na ordem acima" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  DOCUMENTAÇÃO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "📄 CORRECOES_APLICADAS.md" -ForegroundColor Cyan
Write-Host "   Documentação completa de todas as correções" -ForegroundColor White
Write-Host ""

Write-Host "📄 CORRIGIR_TABELA_MEMBERSHIPS.md" -ForegroundColor Cyan
Write-Host "   Guia específico para corrigir memberships" -ForegroundColor White
Write-Host ""

Write-Host "📄 CORRIGIR_ERRO_CLIENTE.md" -ForegroundColor Cyan
Write-Host "   Guia específico para erro ao buscar cliente" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  VERIFICAÇÃO FINAL" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "Após executar todos os scripts, verifique:" -ForegroundColor White
Write-Host "✓ Consegue adicionar clientes" -ForegroundColor Green
Write-Host "✓ Consegue conectar Meta Ads" -ForegroundColor Green
Write-Host "✓ Página do cliente carrega" -ForegroundColor Green
Write-Host "✓ Sidebar mostra suas informações" -ForegroundColor Green
Write-Host "✓ Campanhas são listadas" -ForegroundColor Green
Write-Host ""

Write-Host "Pressione qualquer tecla para abrir a documentação..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Abrir documentação
if (Test-Path "CORRECOES_APLICADAS.md") {
    Start-Process "CORRECOES_APLICADAS.md"
}

# Abrir pasta de scripts SQL
if (Test-Path "database") {
    Start-Process "database"
}

Write-Host ""
Write-Host "Documentação e pasta de scripts abertos!" -ForegroundColor Green
Write-Host "Siga as instruções no arquivo CORRECOES_APLICADAS.md" -ForegroundColor White
Write-Host ""