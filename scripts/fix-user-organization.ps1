# Script para corrigir problema de usuários sem organização
# Execute este script para aplicar as correções no banco de dados

Write-Host "=== Correção de Usuários sem Organização ===" -ForegroundColor Green
Write-Host ""

Write-Host "Este script irá:" -ForegroundColor Yellow
Write-Host "1. Criar uma organização padrão se não existir"
Write-Host "2. Associar todos os usuários existentes à organização padrão"
Write-Host "3. Configurar criação automática de organização para novos usuários"
Write-Host ""

Write-Host "IMPORTANTE:" -ForegroundColor Red
Write-Host "- Você precisa executar os scripts SQL no Supabase SQL Editor"
Write-Host "- Acesse: https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/sql"
Write-Host ""

Write-Host "Passos para executar:" -ForegroundColor Cyan
Write-Host "1. Abra o Supabase SQL Editor"
Write-Host "2. Execute o conteúdo do arquivo: scripts/fix-user-organization.sql"
Write-Host "3. Execute o conteúdo do arquivo: scripts/setup-auto-organization.sql"
Write-Host ""

Write-Host "Arquivos criados:" -ForegroundColor Green
Write-Host "- scripts/fix-user-organization.sql (corrige usuários existentes)"
Write-Host "- scripts/setup-auto-organization.sql (configura automação para novos usuários)"
Write-Host ""

# Mostrar o conteúdo dos arquivos
Write-Host "=== Conteúdo do fix-user-organization.sql ===" -ForegroundColor Yellow
Get-Content "scripts/fix-user-organization.sql"
Write-Host ""

Write-Host "=== Conteúdo do setup-auto-organization.sql ===" -ForegroundColor Yellow
Get-Content "scripts/setup-auto-organization.sql"
Write-Host ""

Write-Host "Após executar os scripts SQL, teste adicionando um novo cliente." -ForegroundColor Green