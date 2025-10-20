# Arquivos para Deletar - Limpeza do Projeto

## Documentação Obsoleta/Duplicada

```bash
# Remover estes arquivos:
AJUSTE_FINAL_PRODUCAO.md
ANALISE_FUNCIONALIDADES_FALTANTES.md
APLICAR_LANDING_PAGE.md
APLICAR_SCHEMA_USUARIOS.md
APPLY_RLS_FIX.md
CAMPANHAS_REAIS_META_ADS.md
CHECKLIST_DEPLOY.md
COMMIT_GIT.md
COMO_USAR_SCRIPTS.md
CONFIGURACAO_GESTOR_ENGRENE.md
CONFIGURACAO_PRODUCAO_COMPLETA.md
CORRECAO_BUILD_PRODUCAO.md
CORRECAO_BUSCA_CLIENTES_FINAL.md
CORRECAO_CAMPANHAS_REAIS_FINAL.md
CORRECAO_ERRO_OAUTH_CANCELADO.md
CORRECAO_FILTROS_CAMPANHAS.md
CORRECAO_METRICAS_CAMPANHAS.md
CORRECAO_SCROLL_DEFINITIVA.md
CORRECAO_SCROLL_DUPLO.md
CORRECOES_APLICADAS.md
CORRECOES_BUSCA_E_MENUS_IMPLEMENTADAS.md
CORRECOES_DEPENDENCIAS_FINAIS.md
CORRIGIR_ERRO_CLIENTE.md
CORRIGIR_TABELA_MEMBERSHIPS.md
CRIAR_TABELA_LEADS_AGORA.md
DASHBOARD_CAMPANHAS_IMPLEMENTADO.md
DASHBOARD_CAMPANHAS_PRODUCAO.md
DASHBOARDS_AVANCADOS_COMPLETO.md
DEPLOY_RAPIDO.md
FASE_2_DASHBOARD_PERSONALIZAVEL_IMPLEMENTADO.md
FASE_2_IMPLEMENTACAO_COMPLETA.md
FASE_2_INTEGRACOES_AUTOMACOES.md
FASE_3_OBJETIVOS_INTELIGENTES_IMPLEMENTADO.md
FEATURES_TEMPORARIAMENTE_DESABILITADAS.md
FUNCIONALIDADES_ADMIN_AVANCADAS_FINAL.md
GERENCIAMENTO_USUARIOS_COMPLETO.md
GUIA_GIT.md
GUIA_RAPIDO_3_PASSOS.md
GUIA_TESTE_SISTEMA_COMPLETO.md
IMPLEMENTACAO_METRICAS_PERSONALIZADAS.md
INTEGRACAO_REAL_META_ADS.md
LANDING_PAGE_IMPLEMENTADA.md
LIMPEZA_ARQUIVOS_DEBUG.md
LIMPEZA_SCRIPTS.md
PAINEL_ADMIN_COMPLETO.md
PLANO_IMPLEMENTACAO_BENCHMARKING.md
PROXIMOS_PASSOS.md
README_SISTEMA.md
RELATORIOS_E_INSIGHTS_IMPLEMENTADOS.md
RESOLVER_PROBLEMA_CLIENTES.md
RESUMO_FASE_2_FINAL.md
RESUMO_IMPLEMENTACAO_FINAL.md
RESUMO_LANDING_PAGE.md
RESUMO_SESSAO_FINAL.md
SCROLLBAR_ESTILIZADA.md
SETUP_DATABASE.md
SIDEBAR_COLAPSAVEL_IMPLEMENTADA.md
SISTEMA_AUTENTICACAO_SETUP.md
SISTEMA_ONBOARDING_COMPLETO.md
SISTEMA_SAAS_COMPLETO.md
SISTEMA_USUARIOS_PRONTO.md
SUCCESS_SUMMARY.md
TESTE_PRODUCAO_AGORA.md
TROUBLESHOOTING_LEADS.md
```

## Scripts SQL Obsoletos

```bash
# Database - manter apenas:
database/complete-schema.sql
database/landing-leads-schema.sql
database/complete-saas-setup.sql
database/meta-ads-schema.sql

# Deletar:
database/admin-functions.sql
database/advanced-features-schema.sql
database/apply-missing-rls-policies.sql
database/auth-roles-schema.sql
database/check-rls-policies.sql
database/custom-metrics-schema.sql
database/diagnose-system.sql
database/fix-clients-rls.sql
database/fix-memberships-table.sql
database/fix-rls-policies.sql
database/fix-super-admin-permissions.sql
database/landing-leads-2-passos.sql
database/landing-leads-simple.sql
database/migrate-existing-data.sql
database/notifications-schema.sql
database/reset-and-create.sql
database/saas-schema.sql
database/user-management-schema.sql
```

## Scripts PowerShell/JS Obsoletos

```bash
# Scripts - manter apenas:
scripts/check-env.js

# Deletar:
scripts/apply-advanced-features-schema.js
scripts/apply-landing-schema.js
scripts/apply-user-management-schema.js
scripts/check-database-state.sql
scripts/clean-for-production.js
scripts/fix-all-issues.ps1
scripts/fix-client-access.ps1
scripts/fix-memberships.ps1
scripts/fix-supabase-imports.ps1
scripts/fix-user-organization.ps1
scripts/fix-user-organization.sql
scripts/pre-deploy-check.js
scripts/restart-system.bat
scripts/setup-auto-organization.sql
scripts/setup-real-meta-connection.js
scripts/start-dev.bat
scripts/test-system.js
```

## Comando para Deletar Tudo

```powershell
# Execute no PowerShell (Windows):

# Documentação
Remove-Item -Path "AJUSTE_FINAL_PRODUCAO.md","ANALISE_FUNCIONALIDADES_FALTANTES.md","APLICAR_LANDING_PAGE.md","APLICAR_SCHEMA_USUARIOS.md","APPLY_RLS_FIX.md","CAMPANHAS_REAIS_META_ADS.md","CHECKLIST_DEPLOY.md","COMMIT_GIT.md","COMO_USAR_SCRIPTS.md","CONFIGURACAO_GESTOR_ENGRENE.md","CONFIGURACAO_PRODUCAO_COMPLETA.md","CORRECAO_BUILD_PRODUCAO.md","CORRECAO_BUSCA_CLIENTES_FINAL.md","CORRECAO_CAMPANHAS_REAIS_FINAL.md","CORRECAO_ERRO_OAUTH_CANCELADO.md","CORRECAO_FILTROS_CAMPANHAS.md","CORRECAO_METRICAS_CAMPANHAS.md","CORRECAO_SCROLL_DEFINITIVA.md","CORRECAO_SCROLL_DUPLO.md","CORRECOES_APLICADAS.md","CORRECOES_BUSCA_E_MENUS_IMPLEMENTADAS.md","CORRECOES_DEPENDENCIAS_FINAIS.md","CORRIGIR_ERRO_CLIENTE.md","CORRIGIR_TABELA_MEMBERSHIPS.md","CRIAR_TABELA_LEADS_AGORA.md","DASHBOARD_CAMPANHAS_IMPLEMENTADO.md","DASHBOARD_CAMPANHAS_PRODUCAO.md","DASHBOARDS_AVANCADOS_COMPLETO.md","DEPLOY_RAPIDO.md","FASE_2_DASHBOARD_PERSONALIZAVEL_IMPLEMENTADO.md","FASE_2_IMPLEMENTACAO_COMPLETA.md","FASE_2_INTEGRACOES_AUTOMACOES.md","FASE_3_OBJETIVOS_INTELIGENTES_IMPLEMENTADO.md","FEATURES_TEMPORARIAMENTE_DESABILITADAS.md","FUNCIONALIDADES_ADMIN_AVANCADAS_FINAL.md","GERENCIAMENTO_USUARIOS_COMPLETO.md","GUIA_GIT.md","GUIA_RAPIDO_3_PASSOS.md","GUIA_TESTE_SISTEMA_COMPLETO.md","IMPLEMENTACAO_METRICAS_PERSONALIZADAS.md","INTEGRACAO_REAL_META_ADS.md","LANDING_PAGE_IMPLEMENTADA.md","LIMPEZA_ARQUIVOS_DEBUG.md","LIMPEZA_SCRIPTS.md","PAINEL_ADMIN_COMPLETO.md","PLANO_IMPLEMENTACAO_BENCHMARKING.md","PROXIMOS_PASSOS.md","README_SISTEMA.md","RELATORIOS_E_INSIGHTS_IMPLEMENTADOS.md","RESOLVER_PROBLEMA_CLIENTES.md","RESUMO_FASE_2_FINAL.md","RESUMO_IMPLEMENTACAO_FINAL.md","RESUMO_LANDING_PAGE.md","RESUMO_SESSAO_FINAL.md","SCROLLBAR_ESTILIZADA.md","SETUP_DATABASE.md","SIDEBAR_COLAPSAVEL_IMPLEMENTADA.md","SISTEMA_AUTENTICACAO_SETUP.md","SISTEMA_ONBOARDING_COMPLETO.md","SISTEMA_SAAS_COMPLETO.md","SISTEMA_USUARIOS_PRONTO.md","SUCCESS_SUMMARY.md","TESTE_PRODUCAO_AGORA.md","TROUBLESHOOTING_LEADS.md" -ErrorAction SilentlyContinue

# Database
Remove-Item -Path "database/admin-functions.sql","database/advanced-features-schema.sql","database/apply-missing-rls-policies.sql","database/auth-roles-schema.sql","database/check-rls-policies.sql","database/custom-metrics-schema.sql","database/diagnose-system.sql","database/fix-clients-rls.sql","database/fix-memberships-table.sql","database/fix-rls-policies.sql","database/fix-super-admin-permissions.sql","database/landing-leads-2-passos.sql","database/landing-leads-simple.sql","database/migrate-existing-data.sql","database/notifications-schema.sql","database/reset-and-create.sql","database/saas-schema.sql","database/user-management-schema.sql" -ErrorAction SilentlyContinue

# Scripts
Remove-Item -Path "scripts/apply-advanced-features-schema.js","scripts/apply-landing-schema.js","scripts/apply-user-management-schema.js","scripts/check-database-state.sql","scripts/clean-for-production.js","scripts/fix-all-issues.ps1","scripts/fix-client-access.ps1","scripts/fix-memberships.ps1","scripts/fix-supabase-imports.ps1","scripts/fix-user-organization.ps1","scripts/fix-user-organization.sql","scripts/pre-deploy-check.js","scripts/restart-system.bat","scripts/setup-auto-organization.sql","scripts/setup-real-meta-connection.js","scripts/start-dev.bat","scripts/test-system.js" -ErrorAction SilentlyContinue

Write-Host "Limpeza concluída!" -ForegroundColor Green
```

## Arquivos a Manter

### Documentação Essencial
- README.md (novo, atualizado)
- CHANGELOG.md
- CONTRIBUTING.md
- LICENSE
- docs/META_INTEGRATION.md
- docs/SETUP_META_ADS.md

### Database Essencial
- database/complete-schema.sql
- database/landing-leads-schema.sql
- database/complete-saas-setup.sql
- database/meta-ads-schema.sql

### Scripts Essencial
- scripts/check-env.js
- scripts/README.md (atualizar)

### Configuração
- .env.example
- .env.production.example
- .vercelignore
- vercel.json
- next.config.ts
- package.json
- tsconfig.json
- tailwind.config.ts
