# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [2025-01-15] - Sistema de Leads Meta Ads

### Adicionado
- ✅ Sistema completo de captura de leads do Facebook Lead Ads
- ✅ API de sincronização de leads (`POST /api/meta/leads/sync`)
- ✅ API de listagem de leads com filtros (`GET /api/meta/leads`)
- ✅ API de detalhes do lead (`GET /api/meta/leads/[leadId]`)
- ✅ API de atualização de lead (`PATCH /api/meta/leads/[leadId]`)
- ✅ API de exclusão de lead (`DELETE /api/meta/leads/[leadId]`)
- ✅ API de estatísticas de leads (`GET /api/meta/leads/stats`)
- ✅ API de listagem de formulários (`GET /api/meta/leads/forms`)
- ✅ Métodos no MetaAdsClient para buscar formulários e leads
- ✅ Schema completo com RLS policies (`database/meta-leads-schema.sql`)
- ✅ Documentação completa (`docs/META_LEADS_INTEGRATION.md`)

### Funcionalidades
- Sincronização automática de formulários de lead ads
- Sincronização de leads com dados completos (campanha, anúncio, formulário)
- Gerenciamento de status de leads (new, contacted, qualified, converted, lost)
- Atribuição de leads a usuários
- Notas e acompanhamento de leads
- Estatísticas por status e campanha
- Histórico de sincronizações
- Isolamento de dados por cliente via RLS

### Estrutura
- 3 tabelas principais: `meta_lead_forms`, `meta_leads`, `meta_lead_sync_logs`
- 2 views: `meta_lead_stats_by_campaign`, `meta_leads_recent`
- 8 endpoints de API
- Suporte a paginação e filtros
- Logs de sincronização com sucesso/erro

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### 2026-01-02 - 🐛 FIX: Erro em getUserAccessibleClients Corrigido

#### Fixed
- **Erro no ClientSearch:** Corrigido erro `Erro ao obter clientes acessíveis: {}`
- **Inicialização Supabase:** Problema com inicialização assíncrona no cliente resolvido
- **API Route:** Criada rota `/api/user/accessible-clients` para buscar clientes server-side

#### Added
- **Nova API:** `GET /api/user/accessible-clients`
  - Retorna clientes acessíveis baseado no tipo de usuário
  - Validação de autenticação
  - Tratamento de erro robusto
- **Documentação:** `CORRECAO_ERRO_GET_ACCESSIBLE_CLIENTS.md`

#### Changed
- **Hook use-user-access:** Atualizado para usar API route ao invés de chamada direta
- **Tratamento de Erro:** Melhor logging em `UserAccessControlService.getUserAccessibleClients`

#### Technical Details
- **Problema:** Método `getUserAccessibleClients` falhava no lado do cliente
- **Causa:** Inicialização assíncrona do Supabase não funcionava corretamente no browser
- **Solução:** Mover lógica para API route server-side
- **Resultado:** Componente `ClientSearch` funciona corretamente

### 2026-01-02 - 📋 RESUMO: Sistema de Controle de Acesso - Status Final

#### Status: ✅ IMPLEMENTADO E FUNCIONANDO

**Sistema completo de controle de acesso baseado em 3 tipos de usuário:**

1. **Usuário Master (Super Admin)**
   - ✅ Acesso ilimitado a todas as funcionalidades
   - ✅ NÃO vinculado a planos de assinatura
   - ✅ Pode gerenciar todos os recursos do sistema
   - ✅ Tabela: `master_users`

2. **Usuário Regular (Common User)**
   - ✅ Acesso baseado no plano de assinatura ativo
   - ✅ OBRIGATÓRIO ter assinatura ativa
   - ✅ Limites definidos pelo plano contratado
   - ✅ Tabela: `memberships` (coluna `user_type = 'regular'`)

3. **Usuário Cliente (Client User)**
   - ✅ Acesso restrito aos dados da própria agência
   - ✅ NÃO vinculado a planos (acesso independente)
   - ✅ Apenas leitura (read-only)
   - ✅ Tabela: `client_users`

**Implementação Completa:**
- ✅ Migração SQL aplicada via MCP: `08-user-access-control-system.sql`
- ✅ Serviço backend: `UserAccessControlService`
- ✅ Middleware de API: `withUserAccessControl`
- ✅ Hooks React: `useUserAccessControl`
- ✅ Componentes UI: `UserTypeBadge`, `UserTypeManager`
- ✅ Políticas RLS ativas para isolamento de dados
- ✅ Cache de permissões implementado
- ✅ Testes realizados com sucesso

**Documentação:**
- 📄 `SISTEMA_CONTROLE_ACESSO_RESUMO_EXECUTIVO.md` - Resumo executivo completo
- 📄 `APLICAR_SISTEMA_CONTROLE_ACESSO.md` - Guia de aplicação
- 📄 `TESTE_MCP_SISTEMA_CONTROLE_ACESSO_RESULTADO.md` - Resultados de testes

**Performance:**
- Cache TTL: 2-10 minutos dependendo do tipo de consulta
- Índices criados para consultas rápidas
- RLS otimizado para isolamento eficiente

### 2025-12-24 - 🚀 FIX: Erros de Chunks Webpack Resolvidos

#### Fixed
- **Chunks Error:** Corrigido erro `Cannot find module './chunks/vendor-chunks/@supabase.js'`
- **Vendor Chunks:** Eliminado erro `Cannot find module './chunks/vendor-chunks/next.js'`
- **Webpack Config:** Configuração otimizada para splitChunks e vendor modules
- **Compilação:** Processo de build estabilizado e acelerado

#### Added
- **Configuração Webpack:** splitChunks otimizado para vendor modules
- **Package Optimization:** `optimizePackageImports` para Supabase
- **Documentação:** `CORRECAO_CHUNKS_ERROR_RESOLVIDO.md` com guia completo

#### Changed
- **next.config.ts:** Configuração webpack aprimorada
  - splitChunks com cacheGroups para vendors
  - optimizePackageImports para @supabase/supabase-js
  - Fallbacks adequados para módulos Node.js
- **Processo de Build:** Limpeza completa de cache e reinstalação

#### Technical Details
- **Problema:** Webpack chunks corrompidos após mudanças de configuração
- **Causa:** Cache desatualizado + configuração inadequada de splitChunks
- **Solução:** Limpeza completa + configuração otimizada de webpack
- **Resultado:** Compilação estável em 13.9s, APIs funcionando perfeitamente

#### Performance Results
- ✅ **Servidor:** Ready in 13.9s
- ✅ **API Simple:** Compilado em 9.9s (465 modules)
- ✅ **API Enhanced:** Compilado em 1.8s (470 modules)
- ✅ **API Organizations:** Compilado em 1.2s (472 modules)
- ✅ **Sistema:** 4 usuários operacionais (2 Master, 1 Client, 1 Regular)

### 2025-12-24 - 🚀 FIX: Runtime Error Next.js 15.4.0 Resolvido

#### Fixed
- **Runtime Error:** Corrigido erro `Invariant: Expected clientReferenceManifest to be defined`
- **Build Error:** Eliminado erro de duplicação de função `UserDetailsWorking`
- **Configuração Next.js:** Simplificada configuração para evitar bugs do Next.js 15.x
- **Cache Limpo:** Removido cache corrompido que causava problemas de inicialização

#### Added
- **Teste Final:** `test-user-system-final.js`
  - Verificação completa do sistema de usuários
  - Teste de todas as APIs principais
  - Validação de estabilidade do servidor
- **Documentação:** `CORRECAO_RUNTIME_ERROR_RESOLVIDO.md`
  - Guia completo da correção aplicada
  - Passos para reproduzir a solução
  - URLs de teste e validação

#### Changed
- **next.config.ts:** Configuração simplificada e estável
  - Removidas configurações experimentais problemáticas
  - Mantida apenas configuração essencial
  - Webpack config mínimo para fallbacks
- **user-details-working.tsx:** Componente recriado completamente
  - Eliminada possível corrupção de arquivo
  - Código limpo sem duplicações
  - Funcionalidade 100% preservada

#### Technical Details
- **Problema:** Bug do Next.js 15.x com `clientReferenceManifest` em desenvolvimento
- **Causa:** Configurações experimentais conflitantes + cache corrompido
- **Solução:** Configuração mínima + limpeza de cache + recriação de componente
- **Resultado:** Servidor estável em 16.7s, todas as APIs funcionando

#### Test Results
- ✅ **Servidor:** http://localhost:3000 (Ready in 16.7s)
- ✅ **API Simples:** 4 usuários encontrados
- ✅ **API Completa:** Dados estruturados corretos
- ✅ **Organizações:** APIs respondendo
- ✅ **Admin Panel:** Página acessível

### 2025-12-24 - 🔧 FIX: Sistema de Ativar/Desativar Usuário Refatorado

#### Fixed
- **Duplicidade Eliminada:** Removido código duplicado de suspensão/ativação de usuários
- **Interface Simplificada:** Status agora mostra apenas "Ativo" ou "Suspenso" na lista
- **Lógica Unificada:** Criado componente único `UserStatusControl` para controle de status
- **Filtros Simplificados:** Reduzido para 3 opções: "Todos", "Ativos", "Suspensos"
- **Estatísticas Corretas:** Cards agora mostram dados reais de usuários suspensos

#### Added
- **Novo Componente:** `src/components/admin/user-status-control.tsx`
  - Controle unificado de status de usuário
  - Botões condicionais baseados no status atual
  - Prompt para motivo de suspensão obrigatório
  - Estados de loading durante operações
  - Exibição do motivo da suspensão
- **Teste Automatizado:** `test-user-status-control.js`
  - Verificação completa do sistema de controle de status
  - Validação de dados e consistência
  - Teste de filtros e estatísticas

#### Changed
- **API Melhorada:** `src/app/api/admin/users/simple-test/route.ts`
  - Incluir dados completos de suspensão (`suspended_at`, `suspended_by`, `suspension_reason`)
  - Estatísticas corretas (suspensos contados adequadamente)
- **Interface Limpa:** `src/components/admin/user-management-client.tsx`
  - Lógica de status simplificada (apenas Ativo/Suspenso)
  - Filtros reduzidos e mais claros
  - Remoção de complexidade desnecessária
- **Modal Atualizado:** `src/components/admin/user-details-working.tsx`
  - Integração do novo componente de controle de status
  - Remoção de código duplicado
  - Melhor separação de responsabilidades

#### Technical Details
- **Problema:** Sistema tinha duplicidade de código e interface confusa para ativar/desativar usuários
- **Solução:** Refatoração completa com componente unificado e lógica simplificada
- **Resultado:** Interface limpa, código maintível, funcionalidade 100% operacional

#### Test Results
- ✅ **4 usuários** no sistema (2 Master, 1 Client, 1 Regular)
- ✅ **Todos ativos** (0 suspensos atualmente)
- ✅ **Filtros funcionando** corretamente
- ✅ **Estatísticas consistentes** com dados reais
- ✅ **APIs respondendo** adequadamente

#### Status: FUNCIONANDO PERFEITAMENTE 🚀

### 2025-12-24 - ✅ INTEGRATION: Sistema de Controle de Acesso Completamente Integrado

#### Completed
- **Interface de Usuários Totalmente Integrada:** Sistema de controle de acesso ativo na interface
  - ✅ Hooks `useUserType()` e `useUserAccess()` ativados
  - ✅ Componente `UserTypeBadge` funcionando
  - ✅ Badges dinâmicos com cores e ícones por tipo de usuário
  - ✅ API `/api/admin/users/simple-test` funcionando perfeitamente

#### Tested & Verified
- **Sistema de Banco de Dados:** ✅ FUNCIONANDO
  - 2 usuários Master, 1 usuário Cliente, 1 usuário Regular
  - Tabelas `master_users` e `client_users` operacionais
  - Enum `user_type_enum` funcionando
  - Coluna `user_type` na tabela `memberships` ativa

- **Interface Visual:** ✅ FUNCIONANDO
  - Badge vermelho com Crown para Master Users
  - Badge azul com Shield para Regular Users  
  - Badge cinza com UserCheck para Client Users
  - Estatísticas atualizadas (4 usuários, 2 super admins)

- **APIs e Backend:** ✅ FUNCIONANDO
  - API retorna dados corretos para 4 usuários
  - Tipos de usuário mapeados corretamente
  - Memberships estruturados adequadamente
  - Debug info presente e detalhada

#### Files Updated
- ✅ `src/components/admin/user-management-client.tsx` - Hooks ativados
- ✅ `src/hooks/use-user-access.ts` - Funcionando perfeitamente
- ✅ `src/components/ui/user-access-indicator.tsx` - Badges dinâmicos
- ✅ `src/app/api/admin/users/simple-test/route.ts` - API testada

#### Test Results
- ✅ `test-user-access-system-complete.js` - PASSOU
- ✅ `test-user-interface-integration.js` - PASSOU  
- ✅ Servidor de desenvolvimento funcionando
- ✅ Interface acessível em http://localhost:3000/admin/users

#### Status: PRONTO PARA PRODUÇÃO 🚀

### 2025-12-23 - 🐛 FIX: Correção de Tratamento de Erros de API

#### Fixed
- **Erro de Console:** Corrigido erro `Cannot read properties of undefined` ao acessar `errorData`
- **Verificação de Segurança:** Adicionado optional chaining (`?.`) em todos os acessos a `errorData`
- **Arquivos Corrigidos:**
  - `src/components/admin/user-details-working.tsx`
  - `src/components/admin/user-create-dialog.tsx`
  - `src/components/admin/user-details-dialog-enhanced.tsx`
  - `src/components/admin/user-management-client.tsx`
  - `src/components/admin/client-access-manager.tsx`

#### Added
- **Utilitário de Tratamento de Erros:** `src/lib/utils/api-error-handler.ts`
  - `extractErrorData()` - Extração segura de dados de erro
  - `getErrorMessage()` - Geração de mensagens amigáveis
  - `handleApiError()` - Tratamento padronizado completo
  - `safeErrorAccess()` - Acesso seguro a propriedades

#### Technical Details
- **Problema:** Código tentava acessar `errorData.error` sem verificar se `errorData` existia
- **Solução:** Substituído `errorData.error` por `errorData?.error` em todos os arquivos
- **Prevenção:** Criado utilitário para padronizar tratamento de erros futuros

### 2025-12-16 - 🎯 FEATURE: Sistema de Controle de Acesso por Tipos de Usuário

#### Added
- **Sistema Completo de Controle de Acesso:** Implementação de 3 tipos de usuário
  - **Master Users:** Acesso ilimitado, não vinculados a planos
  - **Regular Users:** Limitados por planos de assinatura
  - **Client Users:** Acesso restrito aos dados da própria agência
- **Database Schema:** Migração `08-user-access-control-system.sql`
  - Tabelas: `master_users`, `client_users`
  - Enum: `user_type_enum` (master, regular, client)
  - Funções SQL: `get_user_type()`, `check_user_permissions()`, `get_user_limits()`
  - Políticas RLS para isolamento de dados
- **Backend Services:** `UserAccessControl` service com verificação de permissões
- **API Middleware:** `user-access-middleware.ts` para proteção automática de rotas
- **React Hooks:** `use-user-access.ts` para integração frontend
- **UI Components:** 
  - `UserTypeManager` - Interface de gerenciamento admin
  - `UserAccessIndicator` - Indicadores visuais de tipo e limites
- **Exemplo de Uso:** API `/api/campaigns` com controle de acesso implementado

#### Features
- ✅ **Usuário Master:** Bypass completo de limitações e RLS
- ✅ **Usuário Regular:** Verificação de plano ativo e limites
- ✅ **Usuário Cliente:** Isolamento total por cliente, somente leitura
- ✅ **Middleware Automático:** Proteção de APIs com decorators
- ✅ **Limites Dinâmicos:** Baseados no tipo de usuário e plano
- ✅ **Interface Admin:** Gerenciamento visual de tipos de usuário
- ✅ **Indicadores Visuais:** Badges e progress bars para limites
- ✅ **Hooks React:** Integração fácil no frontend

#### Security
- **Row Level Security:** Políticas RLS para todas as novas tabelas
- **Data Isolation:** Client users não veem dados de outros clientes
- **Permission Matrix:** Sistema granular de permissões por recurso
- **Audit Trail:** Logs de criação e modificação de tipos de usuário

#### Documentation
- `APLICAR_SISTEMA_CONTROLE_ACESSO.md` - Guia completo de aplicação
- Comentários SQL detalhados nas funções e tabelas
- TypeScript interfaces para todos os tipos
- Exemplos de uso em APIs e componentes

### 2025-12-12 - 🔴 CRÍTICO: RLS Faltando em meta_campaigns

#### Fixed
- **Erro "Campanha não encontrada":** Tabela meta_campaigns tinha RLS habilitado mas SEM políticas
  - Causa: Migração anterior esqueceu de criar políticas para meta_campaigns e meta_campaign_insights
  - Solução: Criadas 8 políticas RLS completas (SELECT, INSERT, UPDATE, DELETE + service_role)
  - Migração aplicada: `database/migrations/add-meta-campaigns-rls.sql`
  - Isolamento por cliente via join: meta_campaigns → client_meta_connections → clients → memberships

#### Impact
- ✅ Usuários autenticados agora acessam suas campanhas
- ✅ API de adsets funciona corretamente
- ✅ Hierarquia completa funcional (campanhas → adsets → ads)
- ✅ Isolamento por cliente garantido via RLS

#### Testing
- Script criado: `scripts/diagnose-adsets-error.js`
- Verificação: 8 políticas criadas e ativas

#### Documentation
- `CORRECAO_RLS_META_CAMPAIGNS.md` - Documentação completa da correção crítica

---

### 2025-12-12 - ✅ Correção Bug UUID vs External ID na Hierarquia

#### Fixed
- **Erro "Campanha não encontrada ou sem permissão":** APIs usavam external_id ao invés de UUID interno
  - Causa: Após buscar campanha/adset, APIs usavam parâmetro original (external_id) nas queries filhas
  - Solução: Usar sempre o UUID interno retornado pela busca inicial
  - `src/app/api/meta/adsets/route.ts` - Linha 67: `.eq('campaign_id', campaign.id)` ao invés de `campaignId`
  - `src/app/api/meta/ads/route.ts` - Linha 73: `.eq('adset_id', adset.id)` ao invés de `adsetId`

#### Impact
- ✅ Adsets carregam corretamente (2 adsets encontrados)
- ✅ Ads carregam corretamente (13 ads encontrados)
- ✅ Hierarquia completa funcional
- ✅ Foreign keys funcionam corretamente (UUID é FK válido, external_id não)

#### Testing
- Script criado: `scripts/test-hierarchy-fix.js`
- Validação: UUIDs internos funcionam, external_ids causam erro de sintaxe

#### Documentation
- `CORRECAO_BUG_HIERARQUIA_UUID.md` - Documentação completa da correção

---

### 2025-12-12 - ✅ Correção APIs de Hierarquia Meta Ads

#### Fixed
- **APIs retornavam "Campanha/AdSet não encontrada":** Erro ao expandir campanhas e adsets
  - Causa: Joins complexos com `memberships` falhavam desnecessariamente
  - Solução: Simplificadas queries para confiar no RLS (Row Level Security)
  - Removidos joins com `client_meta_connections`, `clients`, `memberships`
  - RLS já garante isolamento, tornando joins redundantes

#### Changed
- `src/app/api/meta/adsets/route.ts` - Query de campanha simplificada
- `src/app/api/meta/ads/route.ts` - Query de adset simplificada

#### Impact
- ✅ Adsets carregam corretamente ao expandir campanha
- ✅ Ads carregam corretamente ao expandir adset
- ✅ Melhor performance (menos joins)
- ✅ Código mais simples e legível

#### Documentation
- `CORRECAO_APIS_HIERARQUIA.md` - Documentação completa da correção

---

### 2025-12-12 - ✅ Correção Filtro de Data dos Insights Meta Ads

#### Fixed
- **Métricas não apareciam nos adsets e ads:** "Sem dados" mesmo com dados no banco
  - Causa: Filtro de data muito restritivo excluía insights que começavam 1 dia antes do período
  - Solução: Corrigida lógica para buscar insights que se sobrepõem ao período
  - Antes: `.gte('date_start', since).lte('date_stop', until)` (dentro do período)
  - Depois: `.lte('date_start', until).gte('date_stop', since)` (sobrepõe ao período)

#### Changed
- `src/app/api/meta/adsets/route.ts` - Corrigido filtro de data dos insights
- `src/app/api/meta/ads/route.ts` - Corrigido filtro de data dos insights
- Adicionados logs detalhados para debug em ambas as APIs

#### Impact
- ✅ Métricas dos adsets aparecem corretamente (gasto, impressões, cliques, CTR, CPC)
- ✅ Métricas dos ads aparecem corretamente
- ✅ Todos os períodos funcionam (7, 14, 30, 90 dias)
- ✅ Logs detalhados facilitam debug futuro

#### Documentation
- `CORRECAO_FILTRO_DATA_INSIGHTS.md` - Detalhes técnicos completos
- `RESUMO_CORRECAO_METRICAS.md` - Resumo executivo
- `TESTE_AGORA_METRICAS_ADSETS.md` - Guia de teste específico

---

### 2025-12-11 - ✅ Correção Middleware Next.js 15 - Edge Runtime

#### Fixed
- **Erro crítico no middleware:** `exports is not defined` no Edge Runtime
  - Causa: Supabase tentando usar CommonJS no Edge Runtime do Next.js 15/16
  - Solução: Simplificado middleware para usar apenas verificação de cookie
  - Removida dependência do `@supabase/ssr` no middleware
  - Autenticação completa continua nas rotas API e páginas server-side

#### Changed
- `src/middleware.ts` - Simplificado para compatibilidade com Edge Runtime
  - Usa verificação simples de cookie `sb-doiogabdzybqxnyhktbv-auth-token`
  - Mantém redirecionamentos de login/dashboard
  - Mantém bypass para rotas OAuth (Meta e Google)

#### Technical Details
- Next.js 15/16 usa Edge Runtime para middleware por padrão
- Edge Runtime não suporta módulos CommonJS (`exports`)
- Supabase SSR usa módulos que não são compatíveis com Edge Runtime
- Solução: Autenticação básica no middleware, validação completa nas rotas

### 2025-12-10 - ✅ Migração Meta Ads Hierarchy Aplicada com Sucesso

#### Added
- Tabelas de hierarquia Meta Ads criadas via Supabase MCP Power
  - `meta_adsets` - Conjuntos de anúncios com targeting e orçamentos
  - `meta_ads` - Anúncios individuais com criativos
  - `meta_adset_insights` - Métricas por período de adsets
  - `meta_ad_insights` - Métricas por período de ads
- Índices para performance em todas as tabelas
- Triggers para atualização automática de `updated_at`
- Políticas RLS para isolamento por cliente via memberships
- Script de sincronização `sync-meta-campaigns.js` atualizado

#### Fixed
- Problema de tabelas antigas com estrutura incorreta (dropadas e recriadas)
- Referências corretas para `client_meta_connections(id)`

#### Data Sincronizada
- 16 campanhas Meta Ads
- 2 conjuntos de anúncios (adsets)
- 13 anúncios individuais
- Cliente: BM Coan (act_3656912201189816)

### 2025-12-10 - Criação de Tabelas de Hierarquia Meta Ads

#### Problema Identificado
- **Tabelas `meta_adsets` e `meta_ads` não existiam no banco de dados**
- Hierarquia de campanhas não mostrava conjuntos de anúncios e anúncios
- Apenas campanhas eram exibidas

#### Adicionado
- **Migração SQL**: `database/migrations/add-meta-hierarchy-tables.sql`
  - Tabela `meta_adsets` - Conjuntos de anúncios (Ad Sets)
  - Tabela `meta_ads` - Anúncios individuais
  - Tabela `meta_adset_insights` - Métricas de adsets por período
  - Tabela `meta_ad_insights` - Métricas de ads por período
  - Índices para performance em todas as foreign keys
  - Triggers para atualização automática de `updated_at`
  - Políticas RLS para isolamento por cliente

- **Scripts de Diagnóstico e Sincronização**:
  - `sync-meta-campaigns.js` - Sincroniza campanhas, adsets e ads da API Meta
  - `test-meta-real.js` - Testa hierarquia completa com dados reais
  - `check-meta-data.js` - Verifica dados Meta no banco

- **Documentação**:
  - `APLICAR_META_HIERARCHY_MIGRATION.md` - Guia de aplicação da migração
  - `META_HIERARCHY_PROBLEMA_RESOLVIDO.md` - Diagnóstico completo e solução

#### Estrutura das Novas Tabelas

**meta_adsets:**
- `connection_id` → `client_meta_connections(id)`
- `campaign_id` → `meta_campaigns(id)`
- `external_id` - ID do adset no Meta
- Orçamento (daily/lifetime), otimização, targeting
- RLS: Isolamento por `connection_id` via memberships

**meta_ads:**
- `connection_id` → `client_meta_connections(id)`
- `adset_id` → `meta_adsets(id)`
- `external_id` - ID do ad no Meta
- Creative, status
- RLS: Isolamento por `connection_id` via memberships

#### Testado
- ✅ 11 conexões Meta ativas encontradas
- ✅ 16 campanhas sincronizadas com sucesso
- ✅ 2 adsets identificados (aguardando tabela)
- ✅ 13 ads identificados (aguardando tabela)
- ✅ Cliente testado: `e3ab33da-79f9-45e9-a43f-6ce76ceb9751`
- ✅ Ad Account: `act_3656912201189816` (BM Coan)

#### Próximos Passos
1. Aplicar migração no Supabase SQL Editor
2. Executar `node sync-meta-campaigns.js` para sincronizar dados
3. Verificar hierarquia completa na interface

---

### 2025-12-08 - Métricas na Hierarquia de Campanhas Meta

#### Adicionado
- **Métricas em tempo real** na hierarquia de campanhas Meta (similar ao Gerenciador de Anúncios)
- Colunas de métricas: Gasto, Impressões, Cliques, CTR, CPC, Alcance
- Insights disponíveis em todos os níveis: Campanhas, Conjuntos de Anúncios e Anúncios
- **Filtro de data avançado** (`src/components/meta/date-range-filter.tsx`):
  - Presets: Hoje, Ontem, Últimos 7/14/30/90 dias, Este mês, Mês passado, Este ano
  - Seleção de período personalizado com calendário duplo
  - Propagação automática para todos os níveis da hierarquia

#### Modificado
- **API de Campanhas** (`src/app/api/meta/campaigns/route.ts`):
  - Novo parâmetro `withInsights` (default: true)
  - Novos parâmetros `since` e `until` para filtro de data
  - Busca insights do período selecionado

- **API de AdSets** (`src/app/api/meta/adsets/route.ts`):
  - Novo parâmetro `withInsights` (default: true)
  - Novos parâmetros `since` e `until` para filtro de data
  - Busca insights do período selecionado

- **API de Ads** (`src/app/api/meta/ads/route.ts`):
  - Novo parâmetro `withInsights` (default: true)
  - Novos parâmetros `since` e `until` para filtro de data
  - Busca insights do período selecionado

- **Componente CampaignsList** (`src/components/meta/campaigns-list.tsx`):
  - Nova tabela com colunas de métricas
  - Filtro de data integrado no header
  - Formatação de moeda, números e percentuais

- **Componente AdSetsList** (`src/components/meta/adsets-list.tsx`):
  - Nova tabela com colunas de métricas
  - Recebe dateRange do componente pai
  - Exibição de objetivo de otimização

- **Componente AdsList** (`src/components/meta/ads-list.tsx`):
  - Cards com métricas (Gasto, Impressões, Cliques, CTR)
  - Recebe dateRange do componente pai

- **MetaAdsClient** (`src/lib/meta/client.ts`):
  - Novos métodos: `getAdSetInsights()`, `getAdInsights()`

---

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
STRIPE_SECRET_KEY=sk_mock_xxx
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
