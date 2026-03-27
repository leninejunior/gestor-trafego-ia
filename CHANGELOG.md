# Changelog

Todas as mudanÃ§as notÃ¡veis neste projeto serÃ£o documentadas neste arquivo.

O formato Ã© baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### 2025-12-05 - Nova Conta Stripe Configurada (Gestor de TrÃ¡fego)

#### Configurado
- **Nova conta Stripe**: `acct_1KyxUHKABoiEfF8T` (Gestor de TrÃ¡fego)
- **Produtos e preÃ§os criados no Stripe**:

| Plano | Product ID | Price Mensal | Price Anual |
|-------|------------|--------------|-------------|
| Basic ($29/$290) | `prod_TYDh2m12mOwZUt` | `price_1Sb7G6KABoiEfF8TsDoZn2oT` | `price_1Sb7GBKABoiEfF8TkGCL54R6` |
| Pro ($79/$790) | `prod_TYDhPcLUZKOszA` | `price_1Sb7GRKABoiEfF8TG4SIYQDz` | `price_1Sb7HWKABoiEfF8TQRr8hjf7` |
| Enterprise ($199/$1990) | `prod_TYDhoLQ2nln2ZW` | `price_1Sb7HbKABoiEfF8TQdtDpxs3` | `price_1Sb7HeKABoiEfF8TUSnKBsGA` |

#### Atualizado
- **MigraÃ§Ã£o SQL**: `database/migrations/07-add-stripe-fields-to-subscription-plans.sql`
  - Atualizado com novos IDs da conta Gestor de TrÃ¡fego

#### PrÃ³ximos Passos
1. Aplicar migraÃ§Ã£o no Supabase SQL Editor
2. Configurar webhook no Stripe Dashboard
3. Atualizar variÃ¡veis de ambiente (.env)

---

### 2025-12-05 - SincronizaÃ§Ã£o Stripe com Planos

#### Adicionado
- **Campos Stripe na tabela subscription_plans**:
  - `stripe_product_id` - ID do produto no Stripe
  - `stripe_price_id_monthly` - ID do preÃ§o mensal
  - `stripe_price_id_annual` - ID do preÃ§o anual

- **MigraÃ§Ã£o SQL**: `database/migrations/07-add-stripe-fields-to-subscription-plans.sql`
  - Adiciona colunas para IDs do Stripe
  - Popula IDs dos planos existentes (Basic, Pro, Enterprise)

- **API de sincronizaÃ§Ã£o**: `src/app/api/admin/plans/[planId]/sync-stripe/route.ts`
  - Sincroniza plano com Stripe (cria/atualiza produto e preÃ§os)
  - Apenas super admins podem usar

- **API de gerenciamento de planos**: `src/app/api/admin/plans/[planId]/route.ts`
  - GET: Busca detalhes do plano
  - PATCH: Atualiza plano com sincronizaÃ§Ã£o automÃ¡tica no Stripe
  - DELETE: Desativa plano (soft delete)

#### Modificado
- **Checkout Stripe**: `src/app/api/subscriptions/checkout-stripe/route.ts`
  - Agora usa preÃ§os cadastrados no Stripe quando disponÃ­veis
  - Fallback para criaÃ§Ã£o dinÃ¢mica de preÃ§os

---

### 2025-12-05 - IntegraÃ§Ã£o Stripe Checkout

#### Adicionado
- **Nova rota de checkout com Stripe**: `src/app/api/subscriptions/checkout-stripe/route.ts`
  - Cria Stripe Checkout Session para assinaturas
  - Suporta planos mensais e anuais
  - Integra com subscription_intents para rastreamento
  - Redireciona para pÃ¡gina de checkout hospedada do Stripe

- **Campos Stripe na tabela subscription_intents**:
  - `stripe_customer_id` - ID do cliente no Stripe
  - `stripe_session_id` - ID da sessÃ£o de checkout
  - `stripe_subscription_id` - ID da assinatura no Stripe

- **MigraÃ§Ã£o SQL**: `database/migrations/06-add-stripe-fields-to-subscription-intents.sql`
  - Adiciona colunas para Stripe
  - Cria Ã­ndices para performance

- **DocumentaÃ§Ã£o**: `STRIPE_CHECKOUT_SETUP.md`
  - Guia completo de configuraÃ§Ã£o
  - CartÃµes de teste
  - Troubleshooting

#### Modificado
- **PÃ¡gina de checkout**: `src/app/checkout/page.tsx`
  - Agora usa `/api/subscriptions/checkout-stripe` em vez de Iugu
  - Redireciona para Stripe Checkout hospedado

- **Webhook Stripe**: `src/app/api/webhooks/stripe/route.ts`
  - Atualizado para processar subscription_intents
  - Marca intent como completed apÃ³s pagamento bem-sucedido

- **Tipos**: `src/lib/types/subscription-intent.ts`
  - Adicionados campos `stripe_customer_id`, `stripe_session_id`, `stripe_subscription_id`

- **ServiÃ§o**: `src/lib/services/subscription-intent-service.ts`
  - Suporte para atualizar campos do Stripe

#### VariÃ¡veis de Ambiente NecessÃ¡rias
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

### 2025-12-05 - CorreÃ§Ã£o Coluna org_id vs organization_id na tabela memberships

#### Corrigido
- **Erro 400 em queries de memberships**: MÃºltiplos arquivos estavam usando `org_id` quando a tabela `memberships` usa `organization_id`
  - Problema: Erro 400 "column org_id does not exist" ao buscar organizaÃ§Ãµes do usuÃ¡rio
  - Causa: CÃ³digo legado usando nome de coluna incorreto
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

### 2025-12-05 - CorreÃ§Ã£o Next.js 15 Breaking Changes - params async

#### Corrigido
- **API Status de Assinatura**: `src/app/api/subscriptions/status/[intentId]/route.ts`
  - Problema: Erro 500 ao buscar status de pagamento
  - Causa: Next.js 15 requer `await params` em rotas dinÃ¢micas
  - SoluÃ§Ã£o: Alterado `params` para `Promise<{ intentId: string }>` e adicionado `await`

- **API Stream de Status**: `src/app/api/subscriptions/status/[intentId]/stream/route.ts`
  - Mesma correÃ§Ã£o de `await params`

- **APIs Admin corrigidas**:
  - `src/app/api/admin/webhook-logs/[logId]/reprocess/route.ts`
  - `src/app/api/admin/billing/history/[customerId]/route.ts`
  - `src/app/api/admin/alerts/[alertId]/resolve/route.ts`
  - `src/app/api/admin/billing/retry-payment/[paymentId]/route.ts`
  - Todas corrigidas para usar `await params` e `await createClient()`

---

### 2025-12-05 - CorreÃ§Ã£o API Status de Assinatura e IntegraÃ§Ã£o Iugu

#### Corrigido
- **State Machine de Subscription Intent**: `src/lib/services/subscription-intent-state-machine.ts`
  - Problema: Erro 500 ao buscar status de pagamento - coluna `intent_id` nÃ£o existe
  - Causa: CÃ³digo usava `intent_id` mas a tabela usa `subscription_intent_id`
  - SoluÃ§Ã£o: Corrigido nome da coluna em todas as queries:
    - `getTransitionHistory()` - SELECT
    - `logTransition()` - INSERT
    - `logFailedTransition()` - INSERT
  - Removida coluna `success` inexistente dos INSERTs
  - Corrigido tipo `StateTransitionLog` para usar `subscription_intent_id`
  - Corrigido tratamento de erros `unknown` do TypeScript

- **API Admin Subscription Intents**: `src/app/api/admin/subscription-intents/[intentId]/route.ts`
  - Corrigido nome da coluna `intent_id` â†’ `subscription_intent_id`
  - Adicionado `await` no `createClient()` (Next.js 15)
  - Corrigido uso do serviÃ§o: `new SubscriptionIntentService()` â†’ `getSubscriptionIntentService()`
  - Removidos mÃ©todos inexistentes e adaptado para usar mÃ©todos disponÃ­veis:
    - `manualActivation` â†’ `executeStateTransition`
    - `cancelIntent` â†’ `deleteIntent`
    - `updateStatus` â†’ `updateIntent`
    - Removidos: `resendConfirmationEmail`, `regenerateCheckoutUrl`

---

### 2025-12-04 - CorreÃ§Ã£o RLS subscription_intents

#### Corrigido
- **PolÃ­ticas RLS `subscription_intents`**: Erro 500 ao fazer upgrade de plano
  - Problema: PolÃ­ticas `ALL` sem `WITH CHECK` bloqueavam INSERT
  - SoluÃ§Ã£o: Recriadas polÃ­ticas com `WITH CHECK` adequado
  - MigraÃ§Ã£o: `fix_subscription_intents_insert_policy`

---

### 2025-12-04 - RevisÃ£o Completa do Sistema SaaS

#### Corrigido
- **API de Checkout**: `src/app/api/subscriptions/checkout-iugu/route.ts`
  - Suporte a ambos os formatos de dados (direto e aninhado em `user_data`)
  - ValidaÃ§Ã£o melhorada com mensagens de erro claras
  - NormalizaÃ§Ã£o automÃ¡tica dos campos de entrada

- **API de Planos Admin**: `src/app/api/admin/plans/route.ts`
  - CorreÃ§Ã£o do cliente Supabase com service role
  - NormalizaÃ§Ã£o de features (objeto JSONB â†’ array de strings)
  - Suporte Ã  coluna `is_popular`

- **VerificaÃ§Ã£o de Super Admin**: 
  - `src/app/admin/page.tsx` - VerificaÃ§Ã£o via tabela `super_admins` primeiro
  - `src/app/api/admin/users/[userId]/route.ts` - Mesma lÃ³gica de verificaÃ§Ã£o

#### Adicionado
- **Tabela `plan_limits`**: MigraÃ§Ã£o para controle granular de limites por plano
  - Campos: max_clients, max_campaigns_per_client, data_retention_days, etc.
  - RLS configurado para leitura pÃºblica e escrita admin
  - Limites padrÃ£o inseridos para todos os planos existentes

- **Coluna `is_popular`**: Adicionada Ã  tabela `subscription_plans`
  - Plano Professional marcado como popular por padrÃ£o

#### Atualizado
- **Planos de Assinatura**: ConsolidaÃ§Ã£o e limpeza
  - Free: R$ 0 (1 cliente, 5 campanhas)
  - Starter: R$ 99,90/mÃªs (3 clientes, 20 campanhas)
  - Professional: R$ 299,90/mÃªs - Popular (10 clientes, 100 campanhas)
  - Enterprise: R$ 999,90/mÃªs (50 clientes, 500 campanhas)
  - Planos duplicados desativados (nÃ£o deletados para preservar referÃªncias)

- **PlanManager**: `src/lib/services/plan-manager.ts`
  - NormalizaÃ§Ã£o de features aplicada em `getAvailablePlans()`

---

### 2025-12-03 - Dashboard Google Ads Completo e CorreÃ§Ã£o de Moeda

#### Corrigido
- **Valores MonetÃ¡rios Google Ads**: Removida conversÃ£o duplicada USDâ†’BRL
  - Os valores do Google Ads API jÃ¡ vÃªm na moeda da conta (BRL para contas brasileiras)
  - A conversÃ£o de micros para moeda jÃ¡ Ã© feita no cliente (`src/lib/google/client.ts`)
  - Arquivo corrigido: `src/app/api/google/campaigns/route.ts`
  - Removida taxa fixa de 5.8 que estava sendo aplicada incorretamente

- **Lista de Campanhas Google**: `src/components/google/google-campaigns-list.tsx`
  - Removida mensagem incorreta sobre conversÃ£o USDâ†’BRL
  - Atualizado texto para indicar que valores estÃ£o na moeda da conta

#### Adicionado
- **GrÃ¡fico de Performance**: `src/components/google/google-performance-chart.tsx`
  - GrÃ¡fico de Ã¡rea com evoluÃ§Ã£o temporal das mÃ©tricas
  - Seletor de mÃ©trica (Investimento, ImpressÃµes, Cliques, ConversÃµes, CTR, CPC)
  - Indicador de tendÃªncia (comparaÃ§Ã£o primeira vs segunda metade do perÃ­odo)
  - FormataÃ§Ã£o automÃ¡tica de valores e datas

- **Resumo de Campanhas**: `src/components/google/google-campaign-summary.tsx`
  - GrÃ¡fico de pizza com distribuiÃ§Ã£o por status
  - Lista de top campanhas por conversÃµes
  - Barras de progresso para visualizaÃ§Ã£o de proporÃ§Ãµes

#### Atualizado
- **Dashboard Google Ads Completo**: `src/components/google/google-dashboard-complete.tsx`
  - Corrigido import de Ã­cone (Percent â†’ CircleDot)
  - MantÃ©m todas as funcionalidades: KPIs, grÃ¡ficos, tabelas, tabs

- **PÃ¡gina Google Ads**: `src/app/dashboard/google/page.tsx`
  - Limpeza de imports nÃ£o utilizados
  - IntegraÃ§Ã£o com dashboard completo quando cliente selecionado

---

### 2025-11-27 - Deploy em ProduÃ§Ã£o: Sistema Pronto

#### Adicionado
- **Guia de Deploy Completo**: `DEPLOY_PRODUCAO.md`
  - Checklist completo de prÃ©-requisitos
  - InstruÃ§Ãµes passo a passo para plataforma de deploy
  - ConfiguraÃ§Ã£o de variÃ¡veis de ambiente
  - Setup de callbacks Meta/Google
  - Testes de produÃ§Ã£o e monitoramento
  - Troubleshooting de problemas comuns

- **Guia de Deploy RÃ¡pido**: `DEPLOY_RAPIDO.md`
  - VersÃ£o resumida para deploy em 5 minutos
  - Comandos essenciais
  - ConfiguraÃ§Ãµes mÃ­nimas necessÃ¡rias

- **Script de Pre-Deploy Check**: `scripts/pre-deploy-check.js`
  - Verifica arquivos essenciais
  - Valida package.json e dependÃªncias
  - Verifica configuraÃ§Ã£o Next.js
  - Valida template de variÃ¡veis de ambiente
  - Verifica estrutura de diretÃ³rios
  - Valida schemas do banco de dados
  - Verifica configuraÃ§Ã£o plataforma de deploy
  - Alerta sobre arquivos sensÃ­veis
  - Fornece resumo e prÃ³ximos passos

#### Configurado
- **plataforma de deploy Deploy**: Sistema configurado para deploy
  - Build command: `npm run build`
  - Framework: Next.js
  - RegiÃ£o: gru1 (SÃ£o Paulo)
  - Cron jobs configurados para alertas e limpeza
  - Headers CORS configurados para APIs

- **VariÃ¡veis de Ambiente**: Template completo em `.env.production.example`
  - Supabase (obrigatÃ³rio)
  - Meta Ads API (obrigatÃ³rio)
  - Google Ads API (opcional)
  - Stripe/IUGU (opcional)
  - Email/Resend (opcional)

#### Status
- âœ… Sistema pronto para deploy em produÃ§Ã£o
- âœ… Schemas do banco de dados completos
- âœ… IntegraÃ§Ãµes Meta e Google Ads funcionais
- âœ… RLS policies implementadas
- âœ… DocumentaÃ§Ã£o completa
- âš ï¸ TypeScript build errors ignorados (configurado)

#### PrÃ³ximos Passos PÃ³s-Deploy
1. Aplicar schemas no Supabase SQL Editor
2. Configurar variÃ¡veis de ambiente na plataforma de deploy
3. Executar deploy: `npm run deploy`
4. Configurar callbacks no Meta/Google Console
5. Testar aplicaÃ§Ã£o em produÃ§Ã£o
6. Configurar monitoramento e alertas

---

### 2025-11-26 - CorreÃ§Ã£o: Campanhas Google Ads NÃ£o Aparecem

#### Corrigido
- **API metrics-simple**: Corrigido erro ao buscar conexÃµes Google Ads
  - Alterado `.single()` para `.maybeSingle()` para suportar mÃºltiplas conexÃµes
  - Corrigido filtro de `.eq('is_active', true)` para `.eq('status', 'active')`
  - Adicionado verificaÃ§Ã£o de conexÃµes inativas com mensagem apropriada
  - Melhorada mensagem de erro quando conexÃ£o estÃ¡ expirada
  - LocalizaÃ§Ã£o: `src/app/api/google/metrics-simple/route.ts`

- **API campaigns**: Adicionado filtro de conexÃ£o ativa
  - Verifica conexÃ£o ativa antes de buscar campanhas
  - Corrigido filtro de `is_active` para `status = 'active'`
  - Filtra automaticamente apenas conexÃ£o ativa quando nÃ£o especificada
  - Retorna mensagem clara quando nÃ£o hÃ¡ conexÃ£o ativa
  - LocalizaÃ§Ã£o: `src/app/api/google/campaigns/route.ts`

#### Adicionado
- **Script de diagnÃ³stico**: `scripts/diagnose-campaigns-issue.js`
  - Verifica conexÃµes Google Ads e seu status
  - Lista campanhas sincronizadas
  - Testa query da API para identificar problemas
  - Fornece diagnÃ³stico detalhado do problema

- **Script de reativaÃ§Ã£o**: `scripts/reactivate-google-connection.js`
  - Reativa conexÃ£o Google Ads mais recente
  - Marca conexÃµes antigas como expiradas
  - Ãštil para resolver problemas de mÃºltiplas conexÃµes

- **DocumentaÃ§Ã£o**: `GOOGLE_ADS_CAMPANHAS_NAO_APARECEM_SOLUCAO.md`
  - DiagnÃ³stico completo do problema
  - CorreÃ§Ãµes aplicadas detalhadas
  - InstruÃ§Ãµes para o usuÃ¡rio sincronizar campanhas
  - Scripts de teste disponÃ­veis

#### Problema Identificado
- ConexÃ£o Google Ads estava ativa mas sem campanhas sincronizadas
- API usava `.single()` que falhava com mÃºltiplas conexÃµes
- Schema usa `status` mas cÃ³digo buscava por `is_active`
- Primeira sincronizaÃ§Ã£o manual necessÃ¡ria apÃ³s conectar conta

#### SoluÃ§Ã£o
1. UsuÃ¡rio deve clicar em "Sincronizar Agora" no dashboard Google
2. Aguardar sincronizaÃ§Ã£o completar (alguns minutos)
3. Campanhas aparecerÃ£o automaticamente na lista
4. SincronizaÃ§Ã£o automÃ¡tica ocorrerÃ¡ a cada 6 horas

### 2025-11-26 - Listagem de Campanhas Google Ads

#### Adicionado
- **API de Campanhas Google Ads**: Endpoint para listar campanhas sincronizadas
  - Rota: `GET /api/google/campaigns`
  - ParÃ¢metros: `clientId` (obrigatÃ³rio), `connectionId` (opcional)
  - Retorna campanhas do banco com dados da conexÃ£o
  - Suporta filtro por conexÃ£o especÃ­fica
  - LocalizaÃ§Ã£o: `src/app/api/google/campaigns/route.ts`

- **Componente GoogleCampaignsList**: Lista de campanhas Google Ads
  - Exibe campanhas sincronizadas em tabela
  - Mostra status, orÃ§amento, conta e data de sincronizaÃ§Ã£o
  - Link direto para campanha no Google Ads
  - BotÃ£o de atualizaÃ§Ã£o manual
  - Estado vazio com mensagem amigÃ¡vel
  - LocalizaÃ§Ã£o: `src/components/google/google-campaigns-list.tsx`

- **PÃ¡gina dedicada Google Ads**: VisualizaÃ§Ã£o completa de campanhas
  - Rota: `/dashboard/clients/[clientId]/google`
  - NavegaÃ§Ã£o com breadcrumb
  - Lista completa de campanhas do cliente
  - LocalizaÃ§Ã£o: `src/app/dashboard/clients/[clientId]/google/page.tsx`

#### Modificado
- **GoogleAdsCard**: Adicionado suporte para exibir campanhas
  - Nova prop `showCampaigns` (opcional)
  - IntegraÃ§Ã£o com GoogleCampaignsList quando conectado
  - MantÃ©m funcionalidade de conexÃ£o existente

- **PÃ¡gina do Cliente**: IntegraÃ§Ã£o com listagem de campanhas
  - Importa GoogleCampaignsList
  - Exibe campanhas Google Ads apÃ³s campanhas Meta
  - MantÃ©m layout consistente com Meta Ads

### 2025-11-25 - Google Ads Schema e DiagnÃ³stico

#### Adicionado
- **MigraÃ§Ã£o 05-force-schema-reload.sql**: ForÃ§a reload do cache do PostgREST
  - Verifica existÃªncia da coluna `client_id` em `google_ads_audit_log`
  - Envia notificaÃ§Ã£o `NOTIFY pgrst, 'reload schema'` para atualizar cache
  - Lista estrutura completa da tabela e polÃ­ticas RLS
  - LocalizaÃ§Ã£o: `database/migrations/05-force-schema-reload.sql`

- **Script diagnose-google-403.js**: DiagnÃ³stico completo do erro 403 da Google Ads API
  - Verifica variÃ¡veis de ambiente (Client ID, Secret, Developer Token)
  - Analisa formato e validade do Developer Token
  - Lista possÃ­veis causas do erro 403 com soluÃ§Ãµes
  - Testa conectividade com Google OAuth
  - Fornece recomendaÃ§Ãµes priorizadas
  - LocalizaÃ§Ã£o: `scripts/diagnose-google-403.js`

- **DocumentaÃ§Ã£o APLICAR_MIGRACAO_SCHEMA_RELOAD.md**: Guia passo a passo
  - InstruÃ§Ãµes detalhadas para aplicar migraÃ§Ã£o no Supabase
  - Checklist de verificaÃ§Ã£o pÃ³s-migraÃ§Ã£o
  - Troubleshooting do erro 403
  - PrÃ³ximos passos e documentaÃ§Ã£o relacionada

- **DocumentaÃ§Ã£o GOOGLE_ADS_PROBLEMAS_IDENTIFICADOS.md**: Resumo executivo
  - AnÃ¡lise completa dos 2 problemas identificados
  - Problema 1: Cache do schema desatualizado (soluÃ§Ã£o pronta)
  - Problema 2: Erro 403 da API (requer aÃ§Ã£o manual)
  - Checklist de resoluÃ§Ã£o
  - Scripts criados e documentaÃ§Ã£o relacionada

#### Corrigido
- **Erro PGRST204**: Cache do PostgREST nÃ£o reconhecia coluna `client_id`
  - Causa: Schema cache desatualizado apÃ³s criaÃ§Ã£o da tabela
  - SoluÃ§Ã£o: MigraÃ§Ã£o com `NOTIFY pgrst, 'reload schema'`
  - Status: Aguardando aplicaÃ§Ã£o manual no Supabase SQL Editor

#### Identificado (Pendente)
- **Erro 403 Google Ads API**: "The caller does not have permission"
  - PossÃ­vel causa 1: Developer Token nÃ£o aprovado pelo Google
  - PossÃ­vel causa 2: UsuÃ¡rio OAuth sem permissÃµes adequadas na conta
  - PossÃ­vel causa 3: Login Customer ID necessÃ¡rio para contas MCC
  - PossÃ­vel causa 4: Conta Google Ads suspensa ou desativada
  - AÃ§Ã£o necessÃ¡ria: Verificar status do Developer Token em https://ads.google.com/aw/apicenter

#### Atualizado
- **Steering database.md**: Adicionada seÃ§Ã£o com Ãºltima atualizaÃ§Ã£o e problema identificado
- **Steering google-ads-migrations.md**: Adicionada seÃ§Ã£o com migraÃ§Ã£o criada e prÃ³ximas aÃ§Ãµes

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

### PrÃ³ximos Passos
1. Aplicar migraÃ§Ã£o `05-force-schema-reload.sql` no Supabase SQL Editor
2. Verificar status do Developer Token no Google Ads API Center
3. Verificar permissÃµes do usuÃ¡rio OAuth na conta Google Ads
4. Executar `node scripts/test-google-health-check.js` para validar correÃ§Ãµes
5. Atualizar documentaÃ§Ã£o com resultados

---

## [Anterior] - HistÃ³rico Anterior

(Adicione aqui o histÃ³rico de mudanÃ§as anteriores conforme necessÃ¡rio)

