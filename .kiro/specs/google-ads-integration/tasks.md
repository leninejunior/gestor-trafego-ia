# Implementation Plan - Google Ads Integration

- [x] 1. Setup de infraestrutura e banco de dados
  - Criar schema do banco de dados para Google Ads
  - Implementar tabelas: google_ads_connections, google_ads_campaigns, google_ads_metrics, google_ads_sync_logs
  - Aplicar polÃ­ticas RLS em todas as tabelas Google Ads
  - Criar Ã­ndices para otimizaÃ§Ã£o de performance
  - Adicionar variÃ¡veis de ambiente para Google Ads API (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DEVELOPER_TOKEN)
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Implementar Google Ads Client e serviÃ§os core

- [x] 2.1 Criar Google Ads API Client
  - Implementar `src/lib/google/client.ts` com mÃ©todos para autenticaÃ§Ã£o e chamadas Ã  API
  - Criar interfaces TypeScript para campanhas, mÃ©tricas e respostas da API
  - Implementar mÃ©todos: `getCampaigns()`, `getCampaignMetrics()`, `getAccountInfo()`
  - Adicionar tratamento de erros especÃ­ficos da Google Ads API
  - _Requirements: 1.1, 10.1, 10.2_

- [x] 2.2 Implementar Google OAuth Service
  - Criar `src/lib/google/oauth.ts` para gerenciar fluxo OAuth 2.0
  - Implementar `getAuthorizationUrl()`, `exchangeCodeForTokens()`, `refreshToken()`
  - Configurar scopes necessÃ¡rios para Google Ads API
  - Implementar validaÃ§Ã£o de state parameter para seguranÃ§a
  - _Requirements: 1.1, 1.3_

- [x] 2.3 Criar Token Manager
  - Implementar `src/lib/google/token-manager.ts` para gerenciar tokens
  - Adicionar lÃ³gica de refresh automÃ¡tico de tokens
  - Implementar criptografia de tokens antes de salvar no banco
  - Criar mÃ©todo `ensureValidToken()` que verifica e renova tokens expirados
  - _Requirements: 1.3, 10.2_

- [x] 2.4 Implementar Google Ads Repository
  - Criar `src/lib/repositories/google-ads-repository.ts`
  - Implementar mÃ©todos CRUD para connections, campaigns e metrics
  - Adicionar queries otimizadas com filtros e paginaÃ§Ã£o
  - Implementar `getHistoricalMetrics()` para dados de cache
  - _Requirements: 2.1, 2.2, 9.1, 9.2_

- [x] 3. Implementar sincronizaÃ§Ã£o de dados

- [x] 3.1 Criar Google Sync Service
  - Implementar `src/lib/google/sync-service.ts`
  - Criar mÃ©todo `syncCampaigns()` para sincronizaÃ§Ã£o inicial e incremental
  - Implementar `syncMetrics()` para atualizaÃ§Ã£o de mÃ©tricas
  - Adicionar lÃ³gica de retry com exponential backoff
  - Implementar logging de sync em google_ads_sync_logs
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1_

- [x] 3.2 Criar Sync Queue Manager
  - Implementar fila de sincronizaÃ§Ã£o para processar mÃºltiplos clientes
  - Adicionar priorizaÃ§Ã£o de syncs (manual vs automÃ¡tico)
  - Implementar rate limiting para respeitar limites da API
  - Criar sistema de retry para syncs falhados
  - _Requirements: 3.2, 10.1_

- [x] 3.3 Implementar Cron Jobs de sincronizaÃ§Ã£o
  - Criar `src/app/api/cron/google-sync/route.ts` para sync automÃ¡tico
  - Configurar execuÃ§Ã£o a cada 6 horas via plataforma de deploy Cron
  - Implementar lÃ³gica para processar todos os clientes ativos
  - Adicionar notificaÃ§Ãµes em caso de falhas persistentes
  - _Requirements: 3.2, 10.5_

- [x] 3.4 Criar testes para Sync Service
  - Escrever testes unitÃ¡rios para sync-service.ts
  - Mockar respostas da Google Ads API
  - Testar cenÃ¡rios de erro e retry
  - Testar deduplicaÃ§Ã£o de dados
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Implementar API Routes para Google Ads

- [x] 4.1 Criar rotas de autenticaÃ§Ã£o
  - Implementar `POST /api/google/auth` para iniciar OAuth flow
  - Implementar `GET /api/google/callback` para processar callback
  - Adicionar validaÃ§Ã£o de state parameter
  - Implementar seleÃ§Ã£o de mÃºltiplas contas Google Ads
  - Criar `POST /api/google/disconnect` para revogar conexÃ£o
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 4.2 Criar rotas de campanhas
  - Implementar `GET /api/google/campaigns` para listar campanhas
  - Implementar `GET /api/google/campaigns/[id]` para detalhes de campanha
  - Adicionar filtros por status, data e performance
  - Implementar paginaÃ§Ã£o e ordenaÃ§Ã£o
  - Adicionar cache de respostas
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4.3 Criar rotas de sincronizaÃ§Ã£o
  - Implementar `POST /api/google/sync` para sync manual
  - Implementar `GET /api/google/sync/status` para status de sync
  - Adicionar validaÃ§Ã£o de permissÃµes do usuÃ¡rio
  - Implementar rate limiting para syncs manuais
  - _Requirements: 3.1, 3.5_

- [x] 4.4 Criar rotas de mÃ©tricas
  - Implementar `GET /api/google/metrics` para mÃ©tricas de campanhas
  - Adicionar suporte a diferentes perÃ­odos de tempo
  - Implementar agregaÃ§Ãµes (diÃ¡rio, semanal, mensal)
  - Adicionar comparaÃ§Ã£o entre perÃ­odos
  - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [x] 4.5 Criar testes para API routes
  - Escrever testes de integraÃ§Ã£o para todas as rotas
  - Testar autenticaÃ§Ã£o e autorizaÃ§Ã£o
  - Testar validaÃ§Ã£o de parÃ¢metros
  - Testar respostas de erro
  - _Requirements: 1.1, 7.1, 8.1_

- [x] 5. Implementar serviÃ§o de agregaÃ§Ã£o multi-plataforma







- [x] 5.1 Criar Platform Aggregation Service

  - Implementar `src/lib/services/platform-aggregation.ts`
  - Criar mÃ©todo `getAggregatedMetrics()` que combina dados Meta e Google
  - Implementar `comparePlatforms()` para anÃ¡lise comparativa
  - Adicionar normalizaÃ§Ã£o de mÃ©tricas entre plataformas
  - Implementar cÃ¡lculo de mÃ©dias ponderadas
  - _Requirements: 5.1, 5.2, 5.3, 5.4_


- [x] 5.2 Criar rotas de API unificadas

  - Implementar `GET /api/unified/metrics` para mÃ©tricas agregadas
  - Implementar `GET /api/unified/comparison` para comparaÃ§Ã£o de plataformas
  - Adicionar filtros por plataforma e perÃ­odo
  - Implementar cache de dados agregados
  - _Requirements: 5.1, 5.2, 5.3, 5.4_


- [x] 5.3 Criar testes para agregaÃ§Ã£o

  - Testar cÃ¡lculos de mÃ©tricas agregadas
  - Testar normalizaÃ§Ã£o de dados
  - Testar cenÃ¡rios com apenas uma plataforma conectada
  - Testar performance com grandes volumes de dados
  - _Requirements: 5.1, 5.2, 5.5_

- [x] 6. Implementar componentes UI do Google Ads





- [x] 6.1 Criar Google Connection Button


  - Implementar `src/components/google/connect-google-button.tsx`
  - Adicionar indicador de status da conexÃ£o
  - Implementar modal de seleÃ§Ã£o de contas
  - Adicionar feedback visual durante OAuth flow
  - Implementar opÃ§Ã£o de reconexÃ£o
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 6.2 Criar Google Campaigns List


  - Implementar `src/components/google/campaigns-list.tsx`
  - Criar tabela com campanhas e mÃ©tricas principais
  - Adicionar filtros e busca
  - Implementar ordenaÃ§Ã£o por colunas
  - Adicionar indicadores visuais de status
  - Implementar paginaÃ§Ã£o
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6.3 Criar Google Campaign Details


  - Implementar `src/components/google/campaign-details.tsx`
  - Exibir mÃ©tricas detalhadas da campanha
  - Adicionar grÃ¡ficos de tendÃªncia
  - Implementar comparaÃ§Ã£o entre perÃ­odos
  - Mostrar histÃ³rico de performance
  - _Requirements: 7.3, 8.2, 8.5_


- [x] 6.4 Criar Google Sync Status Component

  - Implementar `src/components/google/sync-status.tsx`
  - Mostrar status da Ãºltima sincronizaÃ§Ã£o
  - Adicionar botÃ£o de sync manual
  - Exibir progresso de sync em andamento
  - Mostrar erros de sync se houver
  - _Requirements: 3.5, 10.4_

- [x] 7. Implementar Dashboard Google Ads






- [x] 7.1 Melhorar pÃ¡gina do Dashboard Google

  - Atualizar `src/app/dashboard/google/page.tsx` existente
  - Adicionar cards de KPIs principais (spend, conversions, ROAS, CPA) com dados reais
  - Integrar Google Campaigns List com dados da API
  - Adicionar filtros de data e status funcionais
  - Implementar Google Connection Button se nÃ£o conectado
  - Adicionar Google Sync Status
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [x] 7.2 Criar pÃ¡gina de Analytics Google


  - Criar diretÃ³rio `src/app/dashboard/analytics/google/`
  - Implementar `src/app/dashboard/analytics/google/page.tsx`
  - Adicionar grÃ¡ficos de performance ao longo do tempo
  - Implementar breakdown por tipo de campanha
  - Adicionar anÃ¡lise de conversÃµes
  - Implementar comparaÃ§Ã£o entre perÃ­odos
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_


- [x] 7.3 Criar componentes de visualizaÃ§Ã£o

  - Implementar `src/components/google/performance-chart.tsx` para grÃ¡ficos
  - Criar `src/components/google/metrics-cards.tsx` para cards de mÃ©tricas
  - Implementar `src/components/google/campaign-status-badge.tsx`
  - Criar `src/components/google/date-range-selector.tsx`
  - _Requirements: 4.2, 4.3, 7.3, 8.2_

- [x] 8. Implementar Dashboard Unificado




- [x] 8.1 Melhorar Dashboard Principal


  - Atualizar `src/app/dashboard/page.tsx` existente para exibir mÃ©tricas consolidadas reais
  - Adicionar cards de KPIs totais (ambas plataformas) com dados da API
  - Implementar indicadores de performance por plataforma
  - Adicionar links rÃ¡pidos para dashboards especÃ­ficos
  - Mostrar status de conexÃ£o de ambas plataformas
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8.2 Criar Platform Comparison Component


  - Implementar `src/components/unified/platform-comparison.tsx`
  - Adicionar grÃ¡fico comparativo Meta vs Google
  - Implementar tabela de mÃ©tricas lado a lado
  - Adicionar indicadores de melhor performance
  - Permitir seleÃ§Ã£o de mÃ©tricas para comparar
  - _Requirements: 5.2, 5.3_


- [x] 8.3 Criar Unified Metrics Cards

  - Implementar `src/components/unified/unified-metrics-cards.tsx`
  - Exibir totais agregados com breakdown por plataforma
  - Adicionar indicadores de variaÃ§Ã£o percentual
  - Implementar tooltips com detalhes
  - _Requirements: 5.1, 5.2_

- [x] 9. Atualizar navegaÃ§Ã£o e menu




- [x] 9.1 Completar Sidebar


  - Verificar `src/components/dashboard/sidebar.tsx`
  - Adicionar item "Insights Google" no menu (Google Ads jÃ¡ existe)
  - Implementar indicadores de conexÃ£o ao lado dos itens
  - Manter todos os itens existentes da Meta intactos
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 11.1, 11.4_

- [x] 9.2 Atualizar Header
  - Modificar `src/components/dashboard/header.tsx` se necessÃ¡rio
  - Adicionar seletor de plataforma se aplicÃ¡vel
  - Manter compatibilidade com funcionalidades existentes
  - _Requirements: 11.1, 11.2_

- [x] 10. Implementar exportaÃ§Ã£o de dados





- [x] 10.1 Criar Export Service


  - Implementar `src/lib/services/export-service.ts`
  - Adicionar suporte para exportaÃ§Ã£o de dados Google Ads
  - Implementar exportaÃ§Ã£o consolidada (Meta + Google)
  - Suportar formatos CSV e JSON
  - Implementar processamento assÃ­ncrono para grandes volumes
  - _Requirements: 12.1, 12.2, 12.3, 12.5_

- [x] 10.2 Criar rotas de exportaÃ§Ã£o


  - Implementar `POST /api/exports/google` para exportar dados Google
  - Implementar `POST /api/exports/unified` para exportaÃ§Ã£o consolidada
  - Implementar `GET /api/exports/[id]/download` para download
  - Adicionar validaÃ§Ã£o de limites baseado no plano
  - _Requirements: 12.1, 12.2, 12.4_


- [x] 10.3 Criar UI de exportaÃ§Ã£o

  - Adicionar botÃµes de exportaÃ§Ã£o nos dashboards
  - Implementar modal de configuraÃ§Ã£o de exportaÃ§Ã£o
  - Adicionar seleÃ§Ã£o de mÃ©tricas e perÃ­odo
  - Mostrar progresso de exportaÃ§Ã£o
  - Implementar notificaÃ§Ã£o quando export estiver pronto
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 11. Implementar tratamento de erros e logging







- [x] 11.1 Criar Error Handler para Google Ads
  - Implementar `src/lib/google/error-handler.ts`
  - Adicionar tratamento especÃ­fico para cada tipo de erro da API
  - Implementar retry logic com exponential backoff
  - Criar mensagens de erro user-friendly
  - Adicionar logging detalhado de erros
  - _Requirements: 10.1, 10.2, 10.3, 10.4_


- [x] 11.2 Implementar sistema de notificaÃ§Ãµes

  - Adicionar notificaÃ§Ãµes para erros de sync
  - Implementar alertas para administradores
  - Criar notificaÃ§Ãµes de sucesso para aÃ§Ãµes importantes
  - Integrar com sistema de notificaÃ§Ãµes existente
  - _Requirements: 10.5_




- [x] 11.3 Configurar logging e monitoring

  - Adicionar logs estruturados para todas as operaÃ§Ãµes Google Ads
  - Implementar mÃ©tricas de performance
  - Configurar alertas para erros crÃ­ticos
  - Adicionar dashboard de monitoring (opcional)
  - _Requirements: 10.3, 10.5_



- [x] 12. Implementar seguranÃ§a e criptografia




- [x] 12.1 Configurar criptografia de tokens

  - Implementar criptografia de access_token e refresh_token
  - Usar Supabase Vault ou similar para chaves
  - Adicionar rotaÃ§Ã£o de chaves de criptografia
  - Garantir que tokens nunca apareÃ§am em logs
  - _Requirements: 1.1, 1.3_


- [x] 12.2 Validar e testar RLS policies

  - Testar isolamento de dados entre clientes
  - Validar que usuÃ¡rios sÃ³ acessam dados autorizados
  - Testar cenÃ¡rios de mÃºltiplos clientes com mesma conta Google
  - Adicionar testes automatizados de seguranÃ§a
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_


- [x] 12.3 Implementar audit logging

  - Adicionar logs de acesso a dados sensÃ­veis
  - Registrar todas as operaÃ§Ãµes de conexÃ£o/desconexÃ£o
  - Implementar rastreamento de mudanÃ§as em configuraÃ§Ãµes
  - _Requirements: 2.1, 2.2_



- [x] 13. OtimizaÃ§Ã£o e cache




- [x] 13.1 Implementar cache de mÃ©tricas

  - Configurar Redis ou similar para cache
  - Implementar cache de campanhas (TTL: 5 min)
  - Implementar cache de mÃ©tricas (TTL: 15 min)
  - Implementar cache de dados agregados (TTL: 10 min)
  - Adicionar invalidaÃ§Ã£o de cache em syncs
  - _Requirements: 9.2, 9.3_


- [x] 13.2 Otimizar queries do banco

  - Revisar e otimizar queries complexas
  - Adicionar Ã­ndices adicionais se necessÃ¡rio
  - Implementar paginaÃ§Ã£o eficiente
  - Otimizar agregaÃ§Ãµes multi-plataforma
  - _Requirements: 7.1, 8.1_

- [x] 13.3 Implementar batch operations


  - Otimizar sync para processar em batches
  - Implementar bulk insert de mÃ©tricas
  - Adicionar processamento paralelo quando possÃ­vel
  - _Requirements: 3.1, 3.2_



- [x] 14. Testes de integraÃ§Ã£o e E2E



- [x] 14.1 Criar testes de integraÃ§Ã£o


  - Testar fluxo completo de OAuth
  - Testar sincronizaÃ§Ã£o end-to-end
  - Testar isolamento de dados entre clientes
  - Testar agregaÃ§Ã£o multi-plataforma
  - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [x] 14.2 Criar testes E2E


  - Testar conexÃ£o de conta Google Ads
  - Testar visualizaÃ§Ã£o de campanhas
  - Testar dashboard unificado
  - Testar exportaÃ§Ã£o de dados
  - _Requirements: 1.1, 4.1, 5.1, 12.1_



- [x] 14.3 Testes de compatibilidade















  - Validar que funcionalidades Meta nÃ£o foram afetadas
  - Testar sistema com apenas Meta conectado
  - Testar sistema com apenas Google conectado
  - Testar sistema com ambas plataformas
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_


- [x] 15. DocumentaÃ§Ã£o e migraÃ§Ã£o













- [-] 15. DocumentaÃ§Ã£o e migraÃ§Ã£o



- [x] 15.1 Criar documentaÃ§Ã£o tÃ©cnica


  - Documentar APIs do Google Ads
  - Documentar schema do banco de dados
  - Criar guia de troubleshooting
  - Documentar variÃ¡veis de ambiente necessÃ¡rias
  - _Requirements: 1.1, 2.1_



- [x] 15.2 Criar documentaÃ§Ã£o de usuÃ¡rio

  - Criar guia de conexÃ£o Google Ads
  - Documentar funcionalidades do dashboard
  - Criar FAQ de problemas comuns
  - Adicionar screenshots e exemplos
  - _Requirements: 1.1, 4.1, 7.1_




- [x] 15.3 Preparar migraÃ§Ã£o


  - Criar script de aplicaÃ§Ã£o do schema
  - Preparar rollback plan
  - Criar checklist de deploy
  - Documentar processo de configuraÃ§Ã£o inicial
  - _Requirements: 1.1, 2.1_



- [x] 16. Deploy e validaÃ§Ã£o final

- [x] 16. Deploy e validaÃ§Ã£o final

- [x] 16.1 Deploy em staging

  - Aplicar schema do banco de dados
  - Configurar variÃ¡veis de ambiente
  - Deploy do cÃ³digo
  - Executar testes de smoke
  - _Requirements: 1.1, 2.1_


- [x] 16.2 ValidaÃ§Ã£o em staging

  - Testar fluxo completo de conexÃ£o
  - Validar sincronizaÃ§Ã£o de dados
  - Testar todos os dashboards
  - Validar exportaÃ§Ã£o de dados
  - Verificar logs e monitoring
  - _Requirements: 1.1, 3.1, 4.1, 5.1, 12.1_

- [x] 16.3 Deploy em produÃ§Ã£o


  - Aplicar schema em produÃ§Ã£o
  - Deploy do cÃ³digo
  - Monitorar logs e mÃ©tricas
  - Validar funcionalidades crÃ­ticas
  - Comunicar lanÃ§amento aos usuÃ¡rios
  - _Requirements: 1.1, 2.1, 11.1_

