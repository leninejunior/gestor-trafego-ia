# Script para corrigir a tabela memberships
# Execute este script para ver as instruções

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CORREÇÃO DA TABELA MEMBERSHIPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "PROBLEMA IDENTIFICADO:" -ForegroundColor Red
Write-Host "A tabela 'memberships' não possui a coluna 'org_id'" -ForegroundColor Yellow
Write-Host ""

Write-Host "SOLUÇÃO:" -ForegroundColor Green
Write-Host "Execute o script SQL no Supabase para corrigir a estrutura" -ForegroundColor White
Write-Host ""

Write-Host "PASSOS:" -ForegroundColor Cyan
Write-Host "1. Acesse: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "2. Selecione seu projeto" -ForegroundColor White
Write-Host "3. Vá em 'SQL Editor' no menu lateral" -ForegroundColor White
Write-Host "4. Copie e cole o conteúdo abaixo:" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  SCRIPT SQL PARA EXECUTAR" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Mostrar o conteúdo do arquivo SQL
if (Test-Path "database/fix-memberships-table.sql") {
    Get-Content "database/fix-memberships-table.sql" | Write-Host -ForegroundColor Gray
} else {
    Write-Host "ERRO: Arquivo database/fix-memberships-table.sql não encontrado!" -ForegroundColor Red
    Write-Host "Certifique-se de estar na raiz do projeto." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "Após executar o script SQL:" -ForegroundColor Green
Write-Host "✓ A coluna org_id será adicionada" -ForegroundColor White
Write-Host "✓ Uma organização padrão será criada" -ForegroundColor White
Write-Host "✓ Seu usuário será associado à organização" -ForegroundColor White
Write-Host "✓ Você poderá adicionar clientes normalmente" -ForegroundColor White
Write-Host ""

Write-Host "Pressione qualquer tecla para abrir o arquivo SQL..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Abrir o arquivo SQL no editor padrão
if (Test-Path "database/fix-memberships-table.sql") {
    Start-Process "database/fix-memberships-table.sql"
}

Write-Host ""
Write-Host "Arquivo SQL aberto! Copie o conteúdo e execute no Supabase." -ForegroundColor Green
Write-Host ""