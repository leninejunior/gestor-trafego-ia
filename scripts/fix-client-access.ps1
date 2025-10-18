# Script para corrigir acesso aos clientes
# Execute este script para ver as instruções

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CORREÇÃO: ERRO AO BUSCAR CLIENTE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "PROBLEMA:" -ForegroundColor Red
Write-Host "Erro ao carregar página do cliente após conectar Meta Ads" -ForegroundColor Yellow
Write-Host ""

Write-Host "DIAGNÓSTICO:" -ForegroundColor Green
Write-Host "Vamos executar um diagnóstico completo do sistema" -ForegroundColor White
Write-Host ""

Write-Host "PASSOS:" -ForegroundColor Cyan
Write-Host "1. Acesse: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "2. Selecione seu projeto" -ForegroundColor White
Write-Host "3. Vá em 'SQL Editor' no menu lateral" -ForegroundColor White
Write-Host "4. Execute os scripts na ordem abaixo:" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  SCRIPT 1: DIAGNÓSTICO" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Execute primeiro para identificar o problema:" -ForegroundColor White
Write-Host "Arquivo: database/diagnose-system.sql" -ForegroundColor Cyan
Write-Host ""

if (Test-Path "database/diagnose-system.sql") {
    Write-Host "--- CONTEÚDO DO DIAGNÓSTICO ---" -ForegroundColor Gray
    Get-Content "database/diagnose-system.sql" -Head 50
    Write-Host "..." -ForegroundColor Gray
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  SCRIPT 2: CORRIGIR MEMBERSHIPS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Se o diagnóstico mostrar que memberships não tem org_id:" -ForegroundColor White
Write-Host "Arquivo: database/fix-memberships-table.sql" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  SCRIPT 3: CORRIGIR RLS DE CLIENTS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Execute para corrigir as políticas de acesso:" -ForegroundColor White
Write-Host "Arquivo: database/fix-clients-rls.sql" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  APÓS EXECUTAR OS SCRIPTS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "✓ Recarregue a página do cliente no navegador" -ForegroundColor White
Write-Host "✓ Verifique o console do navegador (F12)" -ForegroundColor White
Write-Host "✓ O erro deve estar mais detalhado agora" -ForegroundColor White
Write-Host "✓ A página deve carregar corretamente" -ForegroundColor White
Write-Host ""

Write-Host "DOCUMENTAÇÃO COMPLETA:" -ForegroundColor Cyan
Write-Host "Leia: CORRIGIR_ERRO_CLIENTE.md" -ForegroundColor White
Write-Host ""

Write-Host "Pressione qualquer tecla para abrir os arquivos..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Abrir os arquivos
if (Test-Path "CORRIGIR_ERRO_CLIENTE.md") {
    Start-Process "CORRIGIR_ERRO_CLIENTE.md"
}

if (Test-Path "database/diagnose-system.sql") {
    Start-Process "database/diagnose-system.sql"
}

Write-Host ""
Write-Host "Arquivos abertos! Siga as instruções no guia." -ForegroundColor Green
Write-Host ""