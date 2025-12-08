# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### 2025-12-05 - Nova Conta Stripe Configurada (Gestor de Tráfego)

#### Configurado
- **Nova conta Stripe**: `acct_1KyxUHKABoiEfF8T` (Gestor de Tráfego)
- **Produtos e preços criados no Stripe**:

| Plano | Product ID | Price Mensal | Price Anual |
|-------|------------|--------------|-------------|
| Basic ($29/$290) | `prod_TYDh2m12mOwZUt` | `price_1Sb7G6KABoiEfF8TsDoZn2oT` | `price_1Sb7GBKABoiEfF8TkGCL54R6` |
| Pro ($79/$790) | `prod_TYDhPcLUZKOszA` | `price_1Sb7GRKABoiEfF8TG4SIYQDz` | `price_1Sb7HWKABoiEfF8TQRr8hjf7` |
| Enterprise ($199/$1990) | `prod_TYDhoLQ2nln2ZW` | `price_1Sb7HbKABoiEfF8TQdtDpxs3` | `price_1Sb7HeKABoiEfF8TUSnKBsGA` |

#### Atualizado
- **Migração SQL**: `database/migrations/07-add-stripe-fields-to-subscription-plans.sql`
  - Atualizado com novos IDs da conta Gestor de Tráfego

#### Próximos Passos
1. Aplicar migração no Supabase SQL Editor
2. Configurar webhook no Stripe Dashboard
3. Atualizar variáveis de ambiente (.env)

---

### 2025-12-05 - Sincronização Stripe com Planos

#### Adicionado
- **Campos Stripe na tabela subscription_plans**:
  - `stripe_product_id` - ID do produto no Stripe
  - `stripe_price_id_monthly` - ID do preço mensal
  - `stripe_price_id_annual` - ID do preço anual

- **Migração SQL**: `database/migrations/07-add-stripe-fields-to-subscription-plans.sql`
  - Adiciona colunas para IDs do Stripe
  - Popula IDs dos planos existentes (Basic, Pro, Enterprise)

- **API de sincronização**: `src/app/api/admin/plans/[planId]/sync-stripe/route.ts`
  - Sincroniza plano com Stripe (cria/atualiza produto e preços)
  - Apenas super admins podem usar

- **API de gerenciamento de planos**: `src/app/api/admin/plans/[planId]/route.ts`
  - GET: Busca detalhes do plano
  - PATCH: Atualiza plano com sincronização automática no Stripe
  - DELETE: Desativa plano (soft delete)

#### Modificado
- **Checkout Stripe**: `src/app/api/subscriptions/checkout-stripe/route.ts`
  - Agora usa preços cadastrados no Stripe quando disponíveis
  - Fallback para criação dinâmica de preços

---

### 2025-12-05 - Integração Stripe Checkout

#### Adicionado
- **Nova rota de checkout com Stripe**: `src/app/api/subscriptions/checkout-stripe/route.ts`
  - Cria Stripe Checkout Session para assinaturas
  - Suporta planos mensais e anuais
  - Integra com subscription_intents para rastreamento
  - Redireciona para página de checkout hospedada do Stripe

- **Campos Stripe na tabela subscription_intents**:
  - `stripe_customer_id` - ID do cliente no Stripe
  - `stripe_session_id` - ID da sessão de checkout
  - `stripe_subscription_id` - ID da assinatura no Stripe

- **Migração SQL**: `database/migrations/06-add-stripe-fields-to-subscription-intents.sql`
  - Adiciona colunas para Stripe
  - Cria índices para performance

- **Documentação**: `STRIPE_CHECKOUT_SETUP.md`
  - Guia completo de configuração
  - Cartões de teste
  - Troubleshooting

#### Modificado
- **Página de checkout**: `src/app/checkout/page.tsx`
  - Agora usa `/api/subscriptions/checkout-stripe` em vez de Iugu
  - Redireciona para Stripe Checkout hospedado

- **Webhook Stripe**: `src/app/api/webhooks/stripe/route.ts`
  - Atualizado para processar subscription_intents
  - Marca intent como completed após pagamento bem-sucedido

- **Tipos**: `src/lib/types/subscription-intent.ts`
  - Adicionados campos `stripe_customer_id`, `stripe_session_id`, `stripe_subscription_id`

- **Serviço**: `src/lib/services/subscription-intent-service.ts`
  - Suporte para atualizar campos do Stripe

#### Variáveis de Ambiente Necessárias
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

### 2025-12-05 - Correção Coluna org_id vs organization_id na tabela memberships

#### Corrigido
- **Erro 400 em queries de memberships**: Múltiplos arquivos estavam usando `org_id` quando a tabela `memberships` usa `organization_id`
  - Problema: Erro 400 "column org_id does not exist" ao buscar organizações do usuário
  - Causa: Código legado usando nome de coluna incorreto
  - Arquivos corrigidos:
    - `src/lib/middleware/plan-limits.ts` - `getUserPlanLimits()` e `getUserUsage()`
    - `src/lib/middleware/super-admin-middleware.ts` - `getDataForSuperAdmin()`
    - `src/lib/services/plan-configuration-service.ts` - `getUserPlanLimits()` e `canAddClient()`
    - `src/app/api/meta/check-connections/route.ts` - GET handler
    - `src/app/api/organization/invites/route.ts` - GET, POST, DELETE handlers
    - `src/app/api/organization/users/route.ts` - GET, DELETE handlers
    - `src/app/api/organization/users/[userId]/route.ts` - PATCH handler

#### Nota
- A tabela `memberships` usa `organization_id` para FK com `organizations`
- A tabela `clients` usa `org_id` para FK com `organizations`
- Sempre verificar a estrutura da tabela antes de fazer queries

---

### 2025-12-05 - Correção Next.js 15 Breaking Changes - params async

#### Corrigido
- **API Status de Assinatura**: `src/app/api/subscriptions/status/[intentId]/route.ts`
  - Problema: Erro 500 ao buscar status de pagamento
  - Causa: Next.js 15 requer `await params` em rotas dinâmicas
  - Solução: Alterado `params` para `Promise<{ intentId: string }>` e adicionado `await`

- **API Stream de Status**: `src/app/api/subscriptions/status/[intentId]/stream/route.ts`
  - Mesma correção de `await params`

- **APIs Admin corrigidas**:
  - `src/app/api/admin/webhook-logs/[logId]/reprocess/route.ts`
  - `src/app/api/admin/billing/history/[customerId]/route.ts`
  - `src/app/api/admin/alerts/[alertId]/resolve/route.ts`
  - `src/app/api/admin/billing/retry-payment/[paymentId]/route.ts`
  - Todas corrigidas para usar `await params` e `await createClient()`

---

### 2025-12-05 - Correção API Status de Assinatura e Integração Iugu

#### Corrigido
- **State Machine de Subscription Intent**: `src/lib/services/subscription-intent-state-machine.ts`
  - Problema: Erro 500 ao buscar status de pagamento - coluna `intent_id` não existe
  - Causa: Código usava `intent_id` mas a tabela usa `subscription_intent_id`
  - Solução: Corrigido nome da coluna em todas as queries:
    - `getTransitionHistory()` - SELECT
    - `logTransition()` - INSERT
    - `logFailedTransition()` - INSERT
  - Removida coluna `success` inexistente dos INSERTs
  - Corrigido tipo `StateTransitionLog` para usar `subscription_intent_id`
  - Corrigido tratamento de erros `unknown` do TypeScript

- **API Admin Subscription Intents**: `src/app/api/admin/subscription-intents/[intentId]/route.ts`
  - Corrigido nome da coluna `intent_id` → `subscription_intent_id`
  - Adicionado `await` no `createClient()` (Next.js 15)
  - Corrigido uso do serviço: `new SubscriptionIntentService()` → `getSubscriptionIntentService()`
  - Removidos métodos inexistentes e adaptado para usar métodos disponíveis:
    - `manualActivation` → `executeStateTransition`
    - `cancelIntent` → `deleteIntent`
    - `updateStatus` → `updateIntent`
    - Removidos: `resendConfirmationEmail`, `regenerateCheckoutUrl`

---

### 2025-12-04 - Correção RLS subscription_intents

#### Corrigido
- **Políticas RLS `subscription_intents`**: Erro 500 ao fazer upgrade de plano
  - Problema: Políticas `ALL` sem `WITH CHECK` bloqueavam INSERT
  - Solução: Recriadas políticas com `WITH CHECK` adequado
  - Migração: `fix_subscription_intents_insert_policy`

---

### 2025-12-04 - Revisão Completa do Sistema SaaS

#### Corrigido
- **API de Checkout**: `src/app/api/subscriptions/checkout-iugu/route.ts`
  - Suporte a ambos os formatos de dados (direto e aninhado em `user_data`)
  - Validação melhorada com mensagens de erro claras
  - Normalização automática dos campos de entrada

- **API de Planos Admin**: `src/app/api/admin/plans/route.ts`
  - Correção do cliente Supabase com service role
  - Normalização de features (objeto JSONB → array de strings)
  - Suporte à coluna `is_popular`

- **Verificação de Super Admin**: 
  - `src/app/admin/page.tsx` - Verificação via tabela `super_admins` primeiro
  - `src/app/api/admin/users/[userId]/route.ts` - Mesma lógica de verificação

#### Adicionado
- **Tabela `plan_limits`**: Migração para controle granular de limites por plano
  - Campos: max_clients, max_campaigns_per_client, data_retention_days, etc.
  - RLS configurado para leitura pública e escrita admin
  - Limites padrão inseridos para todos os planos existentes

- **Coluna `is_popular`**: Adicionada à tabela `subscription_plans`
  - Plano Professional marcado como popular por padrão

#### Atualizado
- **Planos de Assinatura**: Consolidação e limpeza
  - Free: R$ 0 (1 cliente, 5 campanhas)
  - Starter: R$ 99,90/mês (3 clientes, 20 campanhas)
  - Professional: R$ 299,90/mês - Popular (10 clientes, 100 campanhas)
  - Enterprise: R$ 999,90/mês (50 clientes, 500 campanhas)
  - Planos duplicados desativados (não deletados para preservar referências)

- **PlanManager**: `src/lib/services/plan-manager.ts`
  - Normalização de features aplicada em `getAvailablePlans()`

---

### 2025-12-03 - Dashboard Google Ads Completo e Correção de Moeda

#### Corrigido
- **Valores Monetários Google Ads**: Removida conversão duplicada USD→BRL
  - Os valores do Google Ads API já vêm na moeda da conta (BRL para contas brasileiras)
  - A conversão de micros para moeda já é feita no cliente (`src/lib/google/client.ts`)
  - Arquivo corrigido: `src/app/api/google/campaigns/route.ts`
  - Removida taxa fixa de 5.8 que estava sendo aplicada incorretamente

- **Lista de Campanhas Google**: `src/components/google/google-campaigns-list.tsx`
  - Removida mensagem incorreta sobre conversão USD→BRL
  - Atualizado texto para indicar que valores estão na moeda da conta

#### Adicionado
- **Gráfico de Performance**: `src/components/google/google-performance-chart.tsx`
  - Gráfico de área com evolução temporal das métricas
  - Seletor de métrica (Investimento, Impressões, Cliques, Conversões, CTR, CPC)
  - Indicador de tendência (comparação primeira vs segunda metade do período)
  - Formatação automática de valores e datas

- **Resumo de Campanhas**: `src/components/google/google-campaign-summary.tsx`
  - Gráfico de pizza com distribuição por status
  - Lista de top campanhas por conversões
  - Barras de progresso para visualização de proporções

#### Atualizado
- **Dashboard Google Ads Completo**: `src/components/google/google-dashboard-complete.tsx`
  - Corrigido import de ícone (Percent → CircleDot)
  - Mantém todas as funcionalidades: KPIs, gráficos, tabelas, tabs

- **Página Google Ads**: `src/app/dashboard/google/page.tsx`
  - Limpeza de imports não utilizados
  - Integração com dashboard completo quando cliente selecionado

---

### 2025-11-27 - Deploy em Produção: Sistema Pronto

#### Adicionado
- **Guia de Deploy Completo**: `DEPLOY_PRODUCAO.md`
  - Checklist completo de pré-requisitos
  - Instruções passo a passo para Vercel
  - Configuração de variáveis de ambiente
  - Setup de callbacks Meta/Google
  - Testes de produção e monitoramento
  - Troubleshooting de problemas comuns

- **Guia de Deploy Rápido**: `DEPLOY_RAPIDO.md`
  - Versão resumida para deploy em 5 minutos
  - Comandos essenciais
  - Configurações mínimas necessárias

- **Script de Pre-Deploy Check**: `scripts/pre-deploy-check.js`
  - Verifica arquivos essenciais
  - Valida package.json e dependências
  - Verifica configuração Next.js
  - Valida template de variáveis de ambiente
  - Verifica estrutura de diretórios
  - Valida schemas do banco de dados
  - Verifica configuração Vercel
  - Alerta sobre arquivos sensíveis
  - Fornece resumo e próximos passos

#### Configurado
- **Vercel Deploy**: Sistema configurado para deploy
  - Build command: `npm run build`
  - Framework: Next.js
  - Região: gru1 (São Paulo)
  - Cron jobs configurados para alertas e limpeza
  - Headers CORS configurados para APIs

- **Variáveis de Ambiente**: Template completo em `.env.production.example`
  - Supabase (obrigatório)
  - Meta Ads API (obrigatório)
  - Google Ads API (opcional)
  - Stripe/IUGU (opcional)
  - Email/Resend (opcional)

#### Status
- ✅ Sistema pronto para deploy em produção
- ✅ Schemas do banco de dados completos
- ✅ Integrações Meta e Google Ads funcionais
- ✅ RLS policies implementadas
- ✅ Documentação completa
- ⚠️ TypeScript build errors ignorados (configurado)

#### Próximos Passos Pós-Deploy
1. Aplicar schemas no Supabase SQL Editor
2. Configurar variáveis de ambiente na Vercel
3. Executar deploy: `npm run deploy`
4. Configurar callbacks no Meta/Google Console
5. Testar aplicação em produção
6. Configurar monitoramento e alertas

---

### 2025-11-26 - Correção: Campanhas Google Ads Não Aparecem

#### Corrigido
- **API metrics-simple**: Corrigido erro ao buscar conexões Google Ads
  - Alterado `.single()` para `.maybeSingle()` para suportar múltiplas conexões
  - Corrigido filtro de `.eq('is_active', true)` para `.eq('status', 'active')`
  - Adicionado verificação de conexões inativas com mensagem apropriada
  - Melhorada mensagem de erro quando conexão está expirada
  - Localização: `src/app/api/google/metrics-simple/route.ts`

- **API campaigns**: Adicionado filtro de conexão ativa
  - Verifica conexão ativa antes de buscar campanhas
  - Corrigido filtro de `is_active` para `status = 'active'`
  - Filtra automaticamente apenas conexão ativa quando não especificada
  - Retorna mensagem clara quando não há conexão ativa
  - Localização: `src/app/api/google/campaigns/route.ts`

#### Adicionado
- **Script de diagnóstico**: `scripts/diagnose-campaigns-issue.js`
  - Verifica conexões Google Ads e seu status
  - Lista campanhas sincronizadas
  - Testa query da API para identificar problemas
  - Fornece diagnóstico detalhado do problema

- **Script de reativação**: `scripts/reactivate-google-connection.js`
  - Reativa conexão Google Ads mais recente
  - Marca conexões antigas como expiradas
  - Útil para resolver problemas de múltiplas conexões

- **Documentação**: `GOOGLE_ADS_CAMPANHAS_NAO_APARECEM_SOLUCAO.md`
  - Diagnóstico completo do problema
  - Correções aplicadas detalhadas
  - Instruções para o usuário sincronizar campanhas
  - Scripts de teste disponíveis

#### Problema Identificado
- Conexão Google Ads estava ativa mas sem campanhas sincronizadas
- API usava `.single()` que falhava com múltiplas conexões
- Schema usa `status` mas código buscava por `is_active`
- Primeira sincronização manual necessária após conectar conta

#### Solução
1. Usuário deve clicar em "Sincronizar Agora" no dashboard Google
2. Aguardar sincronização completar (alguns minutos)
3. Campanhas aparecerão automaticamente na lista
4. Sincronização automática ocorrerá a cada 6 horas

### 2025-11-26 - Listagem de Campanhas Google Ads

#### Adicionado
- **API de Campanhas Google Ads**: Endpoint para listar campanhas sincronizadas
  - Rota: `GET /api/google/campaigns`
  - Parâmetros: `clientId` (obrigatório), `connectionId` (opcional)
  - Retorna campanhas do banco com dados da conexão
  - Suporta filtro por conexão específica
  - Localização: `src/app/api/google/campaigns/route.ts`

- **Componente GoogleCampaignsList**: Lista de campanhas Google Ads
  - Exibe campanhas sincronizadas em tabela
  - Mostra status, orçamento, conta e data de sincronização
  - Link direto para campanha no Google Ads
  - Botão de atualização manual
  - Estado vazio com mensagem amigável
  - Localização: `src/components/google/google-campaigns-list.tsx`

- **Página dedicada Google Ads**: Visualização completa de campanhas
  - Rota: `/dashboard/clients/[clientId]/google`
  - Navegação com breadcrumb
  - Lista completa de campanhas do cliente
  - Localização: `src/app/dashboard/clients/[clientId]/google/page.tsx`

#### Modificado
- **GoogleAdsCard**: Adicionado suporte para exibir campanhas
  - Nova prop `showCampaigns` (opcional)
  - Integração com GoogleCampaignsList quando conectado
  - Mantém funcionalidade de conexão existente

- **Página do Cliente**: Integração com listagem de campanhas
  - Importa GoogleCampaignsList
  - Exibe campanhas Google Ads após campanhas Meta
  - Mantém layout consistente com Meta Ads

### 2025-11-25 - Google Ads Schema e Diagnóstico

#### Adicionado
- **Migração 05-force-schema-reload.sql**: Força reload do cache do PostgREST
  - Verifica existência da coluna `client_id` em `google_ads_audit_log`
  - Envia notificação `NOTIFY pgrst, 'reload schema'` para atualizar cache
  - Lista estrutura completa da tabela e políticas RLS
  - Localização: `database/migrations/05-force-schema-reload.sql`

- **Script diagnose-google-403.js**: Diagnóstico completo do erro 403 da Google Ads API
  - Verifica variáveis de ambiente (Client ID, Secret, Developer Token)
  - Analisa formato e validade do Developer Token
  - Lista possíveis causas do erro 403 com soluções
  - Testa conectividade com Google OAuth
  - Fornece recomendações priorizadas
  - Localização: `scripts/diagnose-google-403.js`

- **Documentação APLICAR_MIGRACAO_SCHEMA_RELOAD.md**: Guia passo a passo
  - Instruções detalhadas para aplicar migração no Supabase
  - Checklist de verificação pós-migração
  - Troubleshooting do erro 403
  - Próximos passos e documentação relacionada

- **Documentação GOOGLE_ADS_PROBLEMAS_IDENTIFICADOS.md**: Resumo executivo
  - Análise completa dos 2 problemas identificados
  - Problema 1: Cache do schema desatualizado (solução pronta)
  - Problema 2: Erro 403 da API (requer ação manual)
  - Checklist de resolução
  - Scripts criados e documentação relacionada

#### Corrigido
- **Erro PGRST204**: Cache do PostgREST não reconhecia coluna `client_id`
  - Causa: Schema cache desatualizado após criação da tabela
  - Solução: Migração com `NOTIFY pgrst, 'reload schema'`
  - Status: Aguardando aplicação manual no Supabase SQL Editor

#### Identificado (Pendente)
- **Erro 403 Google Ads API**: "The caller does not have permission"
  - Possível causa 1: Developer Token não aprovado pelo Google
  - Possível causa 2: Usuário OAuth sem permissões adequadas na conta
  - Possível causa 3: Login Customer ID necessário para contas MCC
  - Possível causa 4: Conta Google Ads suspensa ou desativada
  - Ação necessária: Verificar status do Developer Token em https://ads.google.com/aw/apicenter

#### Atualizado
- **Steering database.md**: Adicionada seção com última atualização e problema identificado
- **Steering google-ads-migrations.md**: Adicionada seção com migração criada e próximas ações

### Arquivos Modificados
```
database/migrations/05-force-schema-reload.sql (novo)
scripts/diagnose-google-403.js (novo)
APLICAR_MIGRACAO_SCHEMA_RELOAD.md (novo)
GOOGLE_ADS_PROBLEMAS_IDENTIFICADOS.md (novo)
.kiro/steering/database.md (atualizado)
.kiro/steering/google-ads-migrations.md (atualizado)
CHANGELOG.md (atualizado)
```

### Próximos Passos
1. Aplicar migração `05-force-schema-reload.sql` no Supabase SQL Editor
2. Verificar status do Developer Token no Google Ads API Center
3. Verificar permissões do usuário OAuth na conta Google Ads
4. Executar `node scripts/test-google-health-check.js` para validar correções
5. Atualizar documentação com resultados

---

## [Anterior] - Histórico Anterior

(Adicione aqui o histórico de mudanças anteriores conforme necessário)
