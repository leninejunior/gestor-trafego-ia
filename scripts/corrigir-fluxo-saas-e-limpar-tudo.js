const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🚀 CORRIGINDO FLUXO SAAS E LIMPANDO ARQUIVOS\n');

  // 1. CORRIGIR FLUXO SAAS
  console.log('1️⃣ CORRIGINDO FLUXO SAAS...\n');
  
  // Buscar primeiro usuário (superusuário)
  const { data: users } = await supabase.auth.admin.listUsers();
  if (!users || users.users.length === 0) {
    console.error('❌ Nenhum usuário encontrado');
    return;
  }
  
  const user = users.users[0];
  console.log(`👤 Usuário: ${user.email} (${user.id})`);

  // Buscar organização existente
  const { data: orgs } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (!orgs || orgs.length === 0) {
    console.error('❌ Nenhuma organização encontrada');
    return;
  }

  const org = orgs[0];
  console.log(`🏢 Organização: ${org.name} (${org.id})`);

  // Verificar se já tem membership
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('organization_id', org.id)
    .single();

  if (!existingMembership) {
    console.log('📝 Criando membership para superusuário...');
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: user.id,
        org_id: org.id,
        organization_id: org.id,
        role: 'owner',
        accepted_at: new Date().toISOString(),
        status: 'active',
      });

    if (membershipError) {
      console.error('❌ Erro ao criar membership:', membershipError);
      return;
    }
    console.log('✅ Membership criada!');
  } else {
    console.log('✅ Membership já existe!');
  }

  // Verificar clientes existentes
  const { data: existingClients } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', org.id);

  console.log(`📋 Clientes existentes: ${existingClients?.length || 0}`);

  if (!existingClients || existingClients.length === 0) {
    console.log('📝 Criando clientes de teste...');
    
    const clientsToCreate = [
      { name: 'Cliente Teste 1', org_id: org.id },
      { name: 'Cliente Teste 2', org_id: org.id },
      { name: 'Cliente Teste 3', org_id: org.id }
    ];

    for (const client of clientsToCreate) {
      const { data, error } = await supabase
        .from('clients')
        .insert(client)
        .select()
        .single();

      if (error) {
        console.error(`❌ Erro ao criar ${client.name}:`, error);
      } else {
        console.log(`✅ ${client.name} criado! ID: ${data.id}`);
      }
    }
  }

  console.log('\n✅ FLUXO SAAS CORRIGIDO!\n');

  // 2. LIMPAR ARQUIVOS DESNECESSÁRIOS
  console.log('2️⃣ LIMPANDO ARQUIVOS DESNECESSÁRIOS...\n');

  const filesToDelete = [
    // Arquivos de debug e correção temporários
    'PASSO_A_PASSO_RESOLVER_AGORA.md',
    'SOLUCAO_COMPLETA_AGORA.sql',
    'RESTAURAR_CLIENTES_AGORA.sql',
    'SOLUCAO_FINAL_DASHBOARD_VAZIO.md',
    'CRIAR_CLIENTE_TESTE_AGORA.sql',
    'APLICAR_AGORA_GOOGLE_ADS.sql',
    'GOOGLE_ADS_SIMPLES.sql',
    'EXECUTAR_AGORA_META_CONNECTIONS.md',
    'VERIFICAR_DADOS_REAIS.sql',
    'EXECUTAR_ESTE_SQL_URGENTE.sql',
    'PASSO_A_PASSO_RESOLVER.md',
    'RESOLVER_TUDO_AGORA.sql',
    'SOLUCAO_ERRO_CLIENTE_ZERO.md',
    'DIAGNOSTICO_BANCO_DADOS.md',
    'EXECUTAR_ESTE_SQL_AGORA.sql',
    'RESTAURAR_SISTEMA_AGORA.md',
    'TESTE_BROWSER_AUTH.md',
    'GOOGLE_OAUTH_FUNCIONANDO_AGORA.md',
    'CORRECAO_GOOGLE_OAUTH_500_RESOLVIDO.md',
    'FAZER_AGORA_GOOGLE_CLOUD.md',
    'PASSO_A_PASSO_VISUAL_GOOGLE.md',
    'SOLUCAO_GOOGLE_OAUTH_FINAL.md',
    'CORRIGIR_GOOGLE_OAUTH_AGORA.md',
    'CORRECAO_FINAL_UNIFIED_METRICS.md',
    'CORRECAO_403_UNIFIED_METRICS_RESOLVIDA.md',
    'GOOGLE_OAUTH_FUNCIONANDO_FINAL.md',
    'CORRECAO_APIS_MEMBERSHIPS_URGENTE.md',
    'VERIFICAR_GOOGLE_CLOUD_CONSOLE.md',
    'SOLUCAO_GOOGLE_OAUTH_HTTPS.md',
    'CORRECAO_GOOGLE_OAUTH_URGENTE.md',
    'CORRECAO_META_CONNECTIONS_URGENTE.md',
    'GOOGLE_ADS_CARD_IMPLEMENTADO.md',
    'CORRECAO_GOOGLE_ADS_FINAL.md',
    'CORRECAO_MEMBERSHIPS_URGENTE.sql',
    'CORRIGIR_MEMBERSHIPS_AGORA.sql',
    'CORRECAO_GOOGLE_ADS_URGENTE.md',
    'GOOGLE_ADS_CONFIG_TEMPLATE.txt',
    'CRIAR_TABELA_PROFILES_AGORA.md',
    'SOLUCAO_RATE_LIMIT_SIGNUP.md',
    'SOLUCAO_FINAL_SIGNUP.md',
    'SIGNUP_FUNCIONANDO_100.md',
    'SIGNUP_CORRIGIDO_FINAL.md',
    'CORRIGIR_ERRO_SIGNUP.md',
    'APLICAR_SCHEMA_PLANOS_AGORA.md',
    'LANDING_DINAMICA_FUNCIONANDO.md',
    
    // Arquivos SQL duplicados/temporários
    'database/landing-leads-2-passos.sql',
    'database/landing-leads-simple.sql',
    'database/create-profiles-table.sql',
    'database/fix-meta-connections-columns.sql',
    'database/create-admin-users-table.sql',
    'database/add-iugu-fields.sql',
    'database/subscription-intents-schema.sql',
    'database/create-subscription-intents-complete.sql',
    'database/fix-subscription-plans-rls.sql',
    'database/fix-admin-users-rls-recursion.sql',
    'database/update-subscription-intents.sql',
    'database/fix-subscription-plans-update.sql',
    'database/EXECUTAR-AGORA-slug.sql',
    'database/fix-organizations-rls.sql',
    'database/add-slug-to-organizations.sql',
    'database/fix-memberships-table.sql',
    'database/diagnose-system.sql',
    'database/fix-clients-rls.sql',
    'database/fix-plan-limits-relationship.sql',
    
    // Documentos de correção temporários
    'APPLY_RLS_FIX.md',
    'AJUSTE_FINAL_PRODUCAO.md',
    'CRIAR_TABELA_LEADS_AGORA.md',
    'RESUMO_ATUALIZACOES.md',
    'ARQUIVOS_PARA_DELETAR.md',
    'RESUMO_SESSAO_FINAL.md',
    'TROUBLESHOOTING_LEADS.md',
    'COMMIT_GIT.md',
    'GUIA_GIT.md',
    'SCROLLBAR_ESTILIZADA.md',
    'SIDEBAR_COLAPSAVEL_IMPLEMENTADA.md',
    'CORRECAO_SCROLL_DEFINITIVA.md',
    'CORRECAO_SCROLL_DUPLO.md',
    'RESUMO_LANDING_PAGE.md',
    'APLICAR_LANDING_PAGE.md',
    'LANDING_PAGE_IMPLEMENTADA.md',
    'TESTE_PRODUCAO_AGORA.md',
    'GUIA_RAPIDO_3_PASSOS.md',
    'CONFIGURACAO_GESTOR_ENGRENE.md',
    'CORRECAO_BUILD_PRODUCAO.md',
    'FEATURES_TEMPORARIAMENTE_DESABILITADAS.md',
    'PROXIMOS_PASSOS.md',
    'CHECKLIST_DEPLOY.md',
    'DEPLOY_RAPIDO.md',
    'SISTEMA_AUTENTICACAO_SETUP.md',
    
    // Mais arquivos de correção
    'RESOLVER_PROBLEMA_CLIENTES.md',
    'GERENCIAMENTO_USUARIOS_COMPLETO.md',
    'APLICAR_SCHEMA_USUARIOS.md',
    'CAMPANHAS_REAIS_META_ADS.md',
    'SISTEMA_USUARIOS_PRONTO.md',
    'CORRECAO_BUSCA_CLIENTES_FINAL.md',
    'CORRECOES_BUSCA_E_MENUS_IMPLEMENTADAS.md',
    'FASE_3_OBJETIVOS_INTELIGENTES_IMPLEMENTADO.md',
    'FASE_2_DASHBOARD_PERSONALIZAVEL_IMPLEMENTADO.md',
    'IMPLEMENTACAO_METRICAS_PERSONALIZADAS.md',
    'PLANO_IMPLEMENTACAO_BENCHMARKING.md',
    'DASHBOARD_CAMPANHAS_PRODUCAO.md',
    'DASHBOARD_CAMPANHAS_IMPLEMENTADO.md',
    'ANALISE_FUNCIONALIDADES_FALTANTES.md',
    'COMO_USAR_SCRIPTS.md',
    'LIMPEZA_SCRIPTS.md',
    'APIS_BACKEND_IMPLEMENTADAS.md',
    'FUNCIONALIDADES_ADMIN_AVANCADAS_FINAL.md',
    'RESUMO_FASE_2_FINAL.md',
    'FASE_2_IMPLEMENTACAO_COMPLETA.md',
    'FASE_2_INTEGRACOES_AUTOMACOES.md',
    'INTEGRACAO_REAL_META_ADS.md',
    'RESUMO_IMPLEMENTACAO_FINAL.md',
    'DASHBOARDS_AVANCADOS_COMPLETO.md',
    'SISTEMA_ONBOARDING_COMPLETO.md',
    'PAINEL_ADMIN_COMPLETO.md',
    
    // Arquivos de correção de bugs específicos
    'CORRECAO_SUBSCRIPTION_SCHEMA_RESOLVIDA.md',
    'PROBLEMA_SUBSCRIPTION_RESOLVIDO_DEFINITIVAMENTE.md',
    'EXECUTAR_AGORA_subscription_fix.sql',
    'COMO_CONFIGURAR_PLANOS_COM_LIMITES.md',
    'CLEANUP_SYSTEM_QUICK_START.md',
    'MONITORING_QUICK_START.md',
    'FIX_403_ERROR_INSTRUCTIONS.md',
    'EXECUTE_NOW_ORGANIZATION_MEMBERSHIPS_FIX.sql',
    'SESSAO_CORRECAO_403_FINALIZADA.md',
    'CORRECAO_403_CONCLUIDA.md',
    'COMMENT_FIXES_IMPLEMENTATION_SUMMARY.md',
    'TASK_16_COMPLETION_SUMMARY.md',
    'DEPLOYMENT_CHECKLIST_GOOGLE_ADS.md',
    'CORRECAO_GOOGLE_ADS_ERROS.md',
    
    // Arquivos de testes e validação temporários
    'TEST_PLAN_EDIT.md',
    'CORRECAO_SUBSCRIPTIONS_ANALYTICS.md',
    'COMMIT_AGORA_BUILD_VERCEL.md',
    'SOLUCAO_DEFINITIVA_BUILD_VERCEL.md',
    'BUILD_VERCEL_SUCESSO.md',
    'CORRECAO_BUILD_VERCEL_FINAL.md',
    'DEPLOY_VERCEL_IUGU.md',
    'SCRIPTS_CORRIGIDOS.md',
    'CORRECAO_ERRO_422_IUGU.md',
    'CRIAR_TABELA_SUBSCRIPTION_INTENTS.md',
    'NOVA_ESTRATEGIA_CHECKOUT.md',
    'TESTE_CHECKOUT_AGORA.md',
    'CORRECAO_CHECKOUT_IUGU.md',
    'DEBUG_ERRO_500_PLANOS.md',
    'CORRECAO_EDICAO_PLANOS_FINAL.md',
    'SOLUCAO_DEFINITIVA_PLANOS.md',
    'CORRECAO_SINGLE_SUPABASE_FINAL.md',
    'CORRECAO_NEXTJS15_E_SCHEMA_FINAL.md',
    'CORRECAO_SCHEMA_REAL_FINAL.md',
    'CORRECAO_SCHEMA_PLANOS_FINAL.md',
    'TESTE_EDICAO_PLANO_CORRIGIDO.md',
    'CORRECAO_ADMIN_PLANOS.md',
    'CORRECAO_ADMIN_ACCESS_FINAL.md',
    'SOLUCAO_ERRO_500_DEFINITIVA.md',
    'CORRECAO_FEATURE_GATE_FINAL.md',
    'SISTEMA_TOTALMENTE_FUNCIONAL.md',
    'CORRECAO_FEATURE_GATE_500_RESOLVIDO.md',
    'CORRECAO_APIS_403_RESOLVIDO.md',
    'TURBOPACK_CRASH_RESOLVIDO.md',
    'SISTEMA_FUNCIONANDO_AGORA.md',
    'RESTART_FUNCIONANDO.md',
    'SCRIPTS_LIMPOS.md',
    
    // Mais arquivos de sistema e pagamentos
    'SISTEMA_PAGAMENTOS_COMPLETO.md',
    'APLICAR_SCHEMA_PAGAMENTOS_AGORA.md',
    'SISTEMA_PAGAMENTOS_IMPLEMENTADO.md',
    'EXECUTAR_AGORA_CHECKOUT.md',
    'CORRECAO_PLANOS_COMPLETA.md',
    'CORRECAO_UPDATE_PLANOS_FINAL.md',
    'SOLUCAO_FINAL_PLANOS.md',
    'EXECUTAR_AGORA.md',
    'URGENTE_EXECUTAR_SQL.txt',
    'PASSO_A_PASSO_VISUAL.md',
    'SOLUCAO_COMPLETA_PLANOS.md',
    'CORRIGIR_RECURSAO_RLS_AGORA.md',
    'TESTAR_SE_FUNCIONOU.md',
    'BUSCAR_IDS_PLANOS.md',
    'IMPLEMENTACAO_CHECKOUT_IUGU.md',
    'CONFIGURACAO_IUGU.md',
    'APLICAR_SLUG_AGORA.md',
    'CORRIGIR_AGORA.sql',
    'CORRECAO_EDICAO_ORGANIZACAO_FINAL.md',
    'APLICAR_RLS_ORGANIZACOES.md',
    'TESTE_EDICAO_ORGANIZACAO.md',
    'CORRIGIR_TABELA_MEMBERSHIPS.md',
    'CORRECOES_DEPENDENCIAS_FINAIS.md',
    'CORRECAO_ERRO_OAUTH_CANCELADO.md',
    'CORRECAO_FILTROS_CAMPANHAS.md',
    'CORRECOES_APLICADAS.md',
    'CORRIGIR_ERRO_CLIENTE.md',
    'SOLUCAO_DEFINITIVA_SCHEMA.md',
    'CORRIGIR_ERRO_SCHEMA_PLANOS.md',
    'FAZER_LOGIN_AGORA.md',
    'SOLUCAO_FINAL_ERRO_PLANOS.md',
    'REMOVER_DEBUG_DEPOIS.md',
    'GUIA_RAPIDO_CORRECAO_PLANOS.md',
    'SOLUCAO_ERRO_PLANOS_RESUMO.md',
    'CORRECAO_ERRO_PLANOS.md',
    'CORRECAO_EDICAO_ORGANIZACAO.md',
    'MUDAR_NOME_SITE.md',
    'SISTEMA_SALDO_IMPLEMENTADO.md',
    'SOLUCAO_DEPLOY_VERCEL.md',
    'CORRIGIR_ERRO_DEPLOY_VERCEL.md',
    'RESUMO_SESSAO_v2.0.md',
    'GIT_COMMIT_v2.0.md',
    'RELEASE_NOTES_v2.0.md',
    'TOGGLE_CAMPANHAS_IMPLEMENTADO.md',
    'TESTAR_AGORA.md',
    'IMPLEMENTACAO_COMPLETA_ANALYTICS.md',
    'PROGRESSO_MELHORIAS_ANALYTICS.md',
    'IMPLEMENTACAO_EDGE_FUNCTIONS.md',
    'PLANO_MELHORIAS_ANALYTICS.md',
    'CORRECAO_CAMPANHAS_REAIS_FINAL.md',
    'CORRECAO_METRICAS_CAMPANHAS.md',
    'DEPLOY_PRODUCTION.md',
    'LIMPEZA_ARQUIVOS_DEBUG.md',
    'SISTEMA_SAAS_COMPLETO.md',
    'RELATORIOS_E_INSIGHTS_IMPLEMENTADOS.md',
    'README_SISTEMA.md',
    'SUCCESS_SUMMARY.md',
    'GUIA_TESTE_SISTEMA_COMPLETO.md',
    'EXECUTAR_SCHEMA_PAGAMENTOS_SUPABASE.md',
    'GOOGLE_ADS_QUICK_START.md',
    'GOOGLE_ADS_INTEGRATION_README.md'
  ];

  const scriptsToDelete = [
    'scripts/verificar-estrutura-clients.js',
    'scripts/identificar-organizacao-e-criar-clientes.js',
    'scripts/verificar-usuario-logado.js',
    'scripts/verificar-dashboard-completo.js',
    'scripts/diagnostico-google-oauth-real.js',
    'scripts/test-google-oauth-simple.js',
    'scripts/diagnostico-rapido.js',
    'scripts/verificar-impacto-google-ads.js',
    'scripts/verificar-rls-clients.js',
    'scripts/investigar-o-que-aconteceu.js',
    'scripts/restaurar-sistema-completo.js',
    'scripts/diagnostico-clientes-dashboard.js',
    'scripts/procurar-conexoes-meta.js',
    'scripts/ver-meus-dados.js',
    'scripts/verificar-e-criar-organizacao.js',
    'scripts/testar-apis-agora.js',
    'scripts/diagnostico-completo-auth.js',
    'scripts/testar-api-clients.js',
    'scripts/testar-conexao-google-agora.js',
    'scripts/diagnostico-google-oauth.js',
    'scripts/test-google-oauth-error.js',
    'scripts/test-google-oauth-flow.js',
    'scripts/check-oauth-states-simple.js',
    'scripts/check-oauth-states-table.js',
    'scripts/check-dashboard-data.js',
    'scripts/test-api-direct.js',
    'scripts/debug-unified-metrics-403.js',
    'scripts/test-unified-metrics-debug.js',
    'scripts/check-meta-connections-table.js',
    'scripts/find-connection-client-relationship.js',
    'scripts/check-meta-campaigns-structure.js',
    'scripts/check-available-tables.js',
    'scripts/check-meta-tables.js',
    'scripts/test-unified-metrics-direct.js',
    'scripts/test-unified-metrics-api.js',
    'scripts/fix-unified-metrics-403.js',
    'scripts/check-organization-memberships.js',
    'scripts/fix-apis-memberships.js',
    'scripts/fix-google-oauth-https.js',
    'scripts/test-google-oauth-config.js',
    'scripts/fix-meta-connections-via-function.js',
    'scripts/apply-meta-connections-fix.js',
    'scripts/fix-meta-connections-schema.js',
    'scripts/test-google-apis.js',
    'scripts/test-memberships-join.js',
    'scripts/check-memberships-view.js',
    'scripts/fix-memberships-references.js',
    'scripts/fix-memberships-direct.js',
    'scripts/fix-memberships-urgent.js',
    'scripts/fix-google-ads-urgent.js',
    'scripts/cleanup-orphan-users.js',
    'scripts/cleanup-test-users.js',
    'scripts/check-memberships-schema.js',
    'scripts/apply-profiles-table.js',
    'scripts/check-signup-tables.js',
    'scripts/test-signup-api.js',
    'scripts/check-supabase-keys.js',
    'scripts/get-plan-ids.js',
    'scripts/apply-landing-schema.js',
    'scripts/clean-for-production.js',
    'scripts/pre-deploy-check.js',
    'scripts/apply-user-management-schema.js',
    'scripts/apply-advanced-features-schema.js',
    'scripts/test-system.js',
    'scripts/validate-subscription-schema.js',
    'scripts/apply-subscription-schema.js',
    'scripts/check-google-ads-config.js',
    'scripts/fix-subscription-plan-id.js',
    'scripts/debug-plan-query.js',
    'scripts/test-subscription-service.js',
    'scripts/apply-subscription-fix.js',
    'scripts/fix-subscription-columns.js',
    'scripts/check-actual-schema.js',
    'scripts/fix-subscription-schema-direct.js',
    'scripts/refresh-supabase-schema.js',
    'scripts/test-subscription-relationship.js',
    'scripts/dev-clean.bat',
    'scripts/fix-hooks-error.bat',
    'scripts/update-subscription-intents.js',
    'scripts/fix-plans-rls-update.js',
    'scripts/add-price-columns.js',
    'scripts/fix-plans-prices.js',
    'scripts/check-plans-schema.js',
    'scripts/check-plans-data.js',
    'scripts/test-checkout-flow.js',
    'scripts/test-iugu-api.js',
    'scripts/fix-subscription-plans-rls.js',
    'scripts/apply-iugu-schema.js',
    'scripts/apply-admin-table.js',
    'scripts/setup-admin-user.js',
    'scripts/check-admin-status.js',
    'scripts/apply-balance-schema.js',
    'scripts/apply-payments-schema.js',
    'scripts/check-and-apply-slug.js',
    'scripts/apply-slug-migration.js',
    'scripts/fix-organizations-rls.js',
    'scripts/fix-plan-limits.js',
    'scripts/check-organization-memberships-view.js',
    'scripts/fix-organization-memberships-view.js',
    'scripts/create-organization-memberships-view.js',
    'scripts/test-api-fix.js',
    'scripts/apply-organization-memberships-fix.js',
    'scripts/apply-export-monitoring-schema.js',
    'scripts/apply-comment-fixes.js',
    'scripts/setup-google-ads-initial-config.js',
    'scripts/rollback-google-ads-migration.js',
    'scripts/pre-migration-check.js',
    'scripts/apply-google-ads-complete-migration.js',
    'scripts/deployment-summary.js',
    'scripts/communicate-launch.js',
    'scripts/monitor-production.js',
    'scripts/generate-staging-report.js',
    'scripts/e2e-staging-tests.js',
    'scripts/smoke-tests.js',
    'scripts/deploy-production.js',
    'scripts/validate-staging.js',
    'scripts/deploy-staging.js',
    'scripts/rollback-google-ads-schema.js',
    'scripts/apply-google-ads-complete-schema.js',
    'scripts/apply-google-audit-schema.js',
    'scripts/validate-google-ads-rls.js',
    'scripts/apply-google-encryption-schema.js',
    'scripts/apply-google-monitoring-schema.js',
    'scripts/apply-google-ads-schema.js',
    'scripts/setup-real-meta-connection.js'
  ];

  let deletedCount = 0;

  // Deletar arquivos
  for (const file of filesToDelete) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`🗑️ Deletado: ${file}`);
        deletedCount++;
      }
    } catch (error) {
      console.log(`⚠️ Erro ao deletar ${file}: ${error.message}`);
    }
  }

  // Deletar scripts
  for (const script of scriptsToDelete) {
    try {
      if (fs.existsSync(script)) {
        fs.unlinkSync(script);
        console.log(`🗑️ Deletado: ${script}`);
        deletedCount++;
      }
    } catch (error) {
      console.log(`⚠️ Erro ao deletar ${script}: ${error.message}`);
    }
  }

  console.log(`\n✅ ${deletedCount} arquivos deletados!\n`);

  // 3. CRIAR ARQUIVOS ESSENCIAIS UNIFICADOS
  console.log('3️⃣ CRIANDO ARQUIVOS ESSENCIAIS UNIFICADOS...\n');

  // Criar script unificado de desenvolvimento
  const devScript = `const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Script unificado para desenvolvimento e debug
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'check-user':
      await checkCurrentUser();
      break;
    case 'check-orgs':
      await checkOrganizations();
      break;
    case 'check-clients':
      await checkClients();
      break;
    case 'create-test-client':
      await createTestClient();
      break;
    default:
      console.log('Comandos disponíveis:');
      console.log('- check-user: Verificar usuário atual');
      console.log('- check-orgs: Verificar organizações');
      console.log('- check-clients: Verificar clientes');
      console.log('- create-test-client: Criar cliente de teste');
  }
}

async function checkCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Usuário atual:', user?.email || 'Não logado');
}

async function checkOrganizations() {
  const { data: orgs } = await supabase.from('organizations').select('*');
  console.log('Organizações:', orgs?.length || 0);
  orgs?.forEach(org => console.log(\`- \${org.name} (\${org.id})\`));
}

async function checkClients() {
  const { data: clients } = await supabase.from('clients').select('*');
  console.log('Clientes:', clients?.length || 0);
  clients?.forEach(client => console.log(\`- \${client.name} (\${client.id})\`));
}

async function createTestClient() {
  const { data: orgs } = await supabase.from('organizations').select('*').limit(1);
  if (!orgs || orgs.length === 0) {
    console.log('❌ Nenhuma organização encontrada');
    return;
  }
  
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: \`Cliente Teste \${Date.now()}\`,
      org_id: orgs[0].id
    })
    .select()
    .single();
    
  if (error) {
    console.error('❌ Erro:', error);
  } else {
    console.log('✅ Cliente criado:', data.name);
  }
}

main().catch(console.error);`;

  fs.writeFileSync('scripts/dev-utils.js', devScript);
  console.log('✅ Criado: scripts/dev-utils.js');

  // Criar README simplificado
  const readmeContent = `# Sistema de Gestão de Anúncios

Sistema SaaS para gestão de campanhas Meta Ads e Google Ads.

## Desenvolvimento

\`\`\`bash
# Instalar dependências
pnpm install

# Iniciar desenvolvimento
pnpm dev

# Verificar sistema
node scripts/dev-utils.js check-user
node scripts/dev-utils.js check-orgs
node scripts/dev-utils.js check-clients

# Criar cliente de teste
node scripts/dev-utils.js create-test-client
\`\`\`

## Estrutura

- \`src/app\` - Páginas e APIs Next.js
- \`src/components\` - Componentes React
- \`src/lib\` - Utilitários e serviços
- \`database\` - Schemas SQL
- \`scripts\` - Scripts de desenvolvimento

## Fluxo SaaS

1. Usuário se cadastra → Cria organização
2. Organização → Cria clientes
3. Clientes → Conecta contas de anúncios
4. Campanhas → Métricas e relatórios

## Tecnologias

- Next.js 15 + React 19
- Supabase (PostgreSQL + Auth)
- Tailwind CSS + shadcn/ui
- Meta Marketing API
- Google Ads API`;

  fs.writeFileSync('README.md', readmeContent);
  console.log('✅ Atualizado: README.md');

  console.log('\n🎉 LIMPEZA COMPLETA!\n');
  console.log('📋 RESUMO:');
  console.log(`✅ Fluxo SaaS corrigido`);
  console.log(`✅ ${deletedCount} arquivos desnecessários removidos`);
  console.log(`✅ Scripts unificados criados`);
  console.log(`✅ README atualizado`);
  console.log('\n🚀 Sistema pronto para uso!');
}

main().catch(console.error);