# Implementation Plan - Google Ads Integration

- [x] 1. Setup de infraestrutura e banco de dados
  - Criar schema do banco de dados para Google Ads
  - Implementar tabelas: google_ads_connections, google_ads_campaigns, google_ads_metrics, google_ads_sync_logs
  - Aplicar políticas RLS em todas as tabelas Google Ads
  - Criar índices para otimização de performance
  - Adicionar variáveis de ambiente para Google Ads API (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DEVELOPER_TOKEN)
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Implementar Google Ads Client e serviços core

- [x] 2.1 Criar Google Ads API Client
  - Implementar `src/lib/google/client.ts` com métodos para autenticação e chamadas à API
  - Criar interfaces TypeScript para campanhas, métricas e respostas da API
  - Implementar métodos: `getCampaigns()`, `getCampaignMetrics()`, `getAccountInfo()`
  - Adicionar tratamento de erros específicos da Google Ads API
  - _Requirements: 1.1, 10.1, 10.2_

- [x] 2.2 Implementar Google OAuth Service
  - Criar `src/lib/google/oauth.ts` para gerenciar fluxo OAuth 2.0
  - Implementar `getAuthorizationUrl()`, `exchangeCodeForTokens()`, `refreshToken()`
  - Configurar scopes necessários para Google Ads API
  - Implementar validação de state parameter para segurança
  - _Requirements: 1.1, 1.3_

- [x] 2.3 Criar Token Manager
  - Implementar `src/lib/google/token-manager.ts` para gerenciar tokens
  - Adicionar lógica de refresh automático de tokens
  - Implementar criptografia de tokens antes de salvar no banco
  - Criar método `ensureValidToken()` que verifica e renova tokens expirados
  - _Requirements: 1.3, 10.2_

- [x] 2.4 Implementar Google Ads Repository
  - Criar `src/lib/repositories/google-ads-repository.ts`
  - Implementar métodos CRUD para connections, campaigns e metrics
  - Adicionar queries otimizadas com filtros e paginação
  - Implementar `getHistoricalMetrics()` para dados de cache
  - _Requirements: 2.1, 2.2, 9.1, 9.2_

- [x] 3. Implementar sincronização de dados

- [x] 3.1 Criar Google Sync Service
  - Implementar `src/lib/google/sync-service.ts`
  - Criar método `syncCampaigns()` para sincronização inicial e incremental
  - Implementar `syncMetrics()` para atualização de métricas
  - Adicionar lógica de retry com exponential backoff
  - Implementar logging de sync em google_ads_sync_logs
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1_

- [x] 3.2 Criar Sync Queue Manager
  - Implementar fila de sincronização para processar múltiplos clientes
  - Adicionar priorização de syncs (manual vs automático)
  - Implementar rate limiting para respeitar limites da API
  - Criar sistema de retry para syncs falhados
  - _Requirements: 3.2, 10.1_

- [x] 3.3 Implementar Cron Jobs de sincronização
  - Criar `src/app/api/cron/google-sync/route.ts` para sync automático
  - Configurar execução a cada 6 horas via Vercel Cron
  - Implementar lógica para processar todos os clientes ativos
  - Adicionar notificações em caso de falhas persistentes
  - _Requirements: 3.2, 10.5_

- [x] 3.4 Criar testes para Sync Service
  - Escrever testes unitários para sync-service.ts
  - Mockar respostas da Google Ads API
  - Testar cenários de erro e retry
  - Testar deduplicação de dados
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Implementar API Routes para Google Ads

- [x] 4.1 Criar rotas de autenticação
  - Implementar `POST /api/google/auth` para iniciar OAuth flow
  - Implementar `GET /api/google/callback` para processar callback
  - Adicionar validação de state parameter
  - Implementar seleção de múltiplas contas Google Ads
  - Criar `POST /api/google/disconnect` para revogar conexão
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 4.2 Criar rotas de campanhas
  - Implementar `GET /api/google/campaigns` para listar campanhas
  - Implementar `GET /api/google/campaigns/[id]` para detalhes de campanha
  - Adicionar filtros por status, data e performance
  - Implementar paginação e ordenação
  - Adicionar cache de respostas
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4.3 Criar rotas de sincronização
  - Implementar `POST /api/google/sync` para sync manual
  - Implementar `GET /api/google/sync/status` para status de sync
  - Adicionar validação de permissões do usuário
  - Implementar rate limiting para syncs manuais
  - _Requirements: 3.1, 3.5_

- [x] 4.4 Criar rotas de métricas
  - Implementar `GET /api/google/metrics` para métricas de campanhas
  - Adicionar suporte a diferentes períodos de tempo
  - Implementar agregações (diário, semanal, mensal)
  - Adicionar comparação entre períodos
  - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [x] 4.5 Criar testes para API routes
  - Escrever testes de integração para todas as rotas
  - Testar autenticação e autorização
  - Testar validação de parâmetros
  - Testar respostas de erro
  - _Requirements: 1.1, 7.1, 8.1_

- [x] 5. Implementar serviço de agregação multi-plataforma







- [x] 5.1 Criar Platform Aggregation Service

  - Implementar `src/lib/services/platform-aggregation.ts`
  - Criar método `getAggregatedMetrics()` que combina dados Meta e Google
  - Implementar `comparePlatforms()` para análise comparativa
  - Adicionar normalização de métricas entre plataformas
  - Implementar cálculo de médias ponderadas
  - _Requirements: 5.1, 5.2, 5.3, 5.4_


- [x] 5.2 Criar rotas de API unificadas

  - Implementar `GET /api/unified/metrics` para métricas agregadas
  - Implementar `GET /api/unified/comparison` para comparação de plataformas
  - Adicionar filtros por plataforma e período
  - Implementar cache de dados agregados
  - _Requirements: 5.1, 5.2, 5.3, 5.4_


- [x] 5.3 Criar testes para agregação

  - Testar cálculos de métricas agregadas
  - Testar normalização de dados
  - Testar cenários com apenas uma plataforma conectada
  - Testar performance com grandes volumes de dados
  - _Requirements: 5.1, 5.2, 5.5_

- [x] 6. Implementar componentes UI do Google Ads





- [x] 6.1 Criar Google Connection Button


  - Implementar `src/components/google/connect-google-button.tsx`
  - Adicionar indicador de status da conexão
  - Implementar modal de seleção de contas
  - Adicionar feedback visual durante OAuth flow
  - Implementar opção de reconexão
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 6.2 Criar Google Campaigns List


  - Implementar `src/components/google/campaigns-list.tsx`
  - Criar tabela com campanhas e métricas principais
  - Adicionar filtros e busca
  - Implementar ordenação por colunas
  - Adicionar indicadores visuais de status
  - Implementar paginação
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6.3 Criar Google Campaign Details


  - Implementar `src/components/google/campaign-details.tsx`
  - Exibir métricas detalhadas da campanha
  - Adicionar gráficos de tendência
  - Implementar comparação entre períodos
  - Mostrar histórico de performance
  - _Requirements: 7.3, 8.2, 8.5_


- [x] 6.4 Criar Google Sync Status Component

  - Implementar `src/components/google/sync-status.tsx`
  - Mostrar status da última sincronização
  - Adicionar botão de sync manual
  - Exibir progresso de sync em andamento
  - Mostrar erros de sync se houver
  - _Requirements: 3.5, 10.4_

- [x] 7. Implementar Dashboard Google Ads






- [x] 7.1 Melhorar página do Dashboard Google

  - Atualizar `src/app/dashboard/google/page.tsx` existente
  - Adicionar cards de KPIs principais (spend, conversions, ROAS, CPA) com dados reais
  - Integrar Google Campaigns List com dados da API
  - Adicionar filtros de data e status funcionais
  - Implementar Google Connection Button se não conectado
  - Adicionar Google Sync Status
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [x] 7.2 Criar página de Analytics Google


  - Criar diretório `src/app/dashboard/analytics/google/`
  - Implementar `src/app/dashboard/analytics/google/page.tsx`
  - Adicionar gráficos de performance ao longo do tempo
  - Implementar breakdown por tipo de campanha
  - Adicionar análise de conversões
  - Implementar comparação entre períodos
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_


- [x] 7.3 Criar componentes de visualização

  - Implementar `src/components/google/performance-chart.tsx` para gráficos
  - Criar `src/components/google/metrics-cards.tsx` para cards de métricas
  - Implementar `src/components/google/campaign-status-badge.tsx`
  - Criar `src/components/google/date-range-selector.tsx`
  - _Requirements: 4.2, 4.3, 7.3, 8.2_

- [x] 8. Implementar Dashboard Unificado




- [x] 8.1 Melhorar Dashboard Principal


  - Atualizar `src/app/dashboard/page.tsx` existente para exibir métricas consolidadas reais
  - Adicionar cards de KPIs totais (ambas plataformas) com dados da API
  - Implementar indicadores de performance por plataforma
  - Adicionar links rápidos para dashboards específicos
  - Mostrar status de conexão de ambas plataformas
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8.2 Criar Platform Comparison Component


  - Implementar `src/components/unified/platform-comparison.tsx`
  - Adicionar gráfico comparativo Meta vs Google
  - Implementar tabela de métricas lado a lado
  - Adicionar indicadores de melhor performance
  - Permitir seleção de métricas para comparar
  - _Requirements: 5.2, 5.3_


- [x] 8.3 Criar Unified Metrics Cards

  - Implementar `src/components/unified/unified-metrics-cards.tsx`
  - Exibir totais agregados com breakdown por plataforma
  - Adicionar indicadores de variação percentual
  - Implementar tooltips com detalhes
  - _Requirements: 5.1, 5.2_

- [x] 9. Atualizar navegação e menu




- [x] 9.1 Completar Sidebar


  - Verificar `src/components/dashboard/sidebar.tsx`
  - Adicionar item "Insights Google" no menu (Google Ads já existe)
  - Implementar indicadores de conexão ao lado dos itens
  - Manter todos os itens existentes da Meta intactos
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 11.1, 11.4_

- [x] 9.2 Atualizar Header
  - Modificar `src/components/dashboard/header.tsx` se necessário
  - Adicionar seletor de plataforma se aplicável
  - Manter compatibilidade com funcionalidades existentes
  - _Requirements: 11.1, 11.2_

- [x] 10. Implementar exportação de dados





- [x] 10.1 Criar Export Service


  - Implementar `src/lib/services/export-service.ts`
  - Adicionar suporte para exportação de dados Google Ads
  - Implementar exportação consolidada (Meta + Google)
  - Suportar formatos CSV e JSON
  - Implementar processamento assíncrono para grandes volumes
  - _Requirements: 12.1, 12.2, 12.3, 12.5_

- [x] 10.2 Criar rotas de exportação


  - Implementar `POST /api/exports/google` para exportar dados Google
  - Implementar `POST /api/exports/unified` para exportação consolidada
  - Implementar `GET /api/exports/[id]/download` para download
  - Adicionar validação de limites baseado no plano
  - _Requirements: 12.1, 12.2, 12.4_


- [x] 10.3 Criar UI de exportação

  - Adicionar botões de exportação nos dashboards
  - Implementar modal de configuração de exportação
  - Adicionar seleção de métricas e período
  - Mostrar progresso de exportação
  - Implementar notificação quando export estiver pronto
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 11. Implementar tratamento de erros e logging







- [x] 11.1 Criar Error Handler para Google Ads
  - Implementar `src/lib/google/error-handler.ts`
  - Adicionar tratamento específico para cada tipo de erro da API
  - Implementar retry logic com exponential backoff
  - Criar mensagens de erro user-friendly
  - Adicionar logging detalhado de erros
  - _Requirements: 10.1, 10.2, 10.3, 10.4_


- [x] 11.2 Implementar sistema de notificações

  - Adicionar notificações para erros de sync
  - Implementar alertas para administradores
  - Criar notificações de sucesso para ações importantes
  - Integrar com sistema de notificações existente
  - _Requirements: 10.5_




- [x] 11.3 Configurar logging e monitoring

  - Adicionar logs estruturados para todas as operações Google Ads
  - Implementar métricas de performance
  - Configurar alertas para erros críticos
  - Adicionar dashboard de monitoring (opcional)
  - _Requirements: 10.3, 10.5_



- [x] 12. Implementar segurança e criptografia




- [x] 12.1 Configurar criptografia de tokens

  - Implementar criptografia de access_token e refresh_token
  - Usar Supabase Vault ou similar para chaves
  - Adicionar rotação de chaves de criptografia
  - Garantir que tokens nunca apareçam em logs
  - _Requirements: 1.1, 1.3_


- [x] 12.2 Validar e testar RLS policies

  - Testar isolamento de dados entre clientes
  - Validar que usuários só acessam dados autorizados
  - Testar cenários de múltiplos clientes com mesma conta Google
  - Adicionar testes automatizados de segurança
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_


- [x] 12.3 Implementar audit logging

  - Adicionar logs de acesso a dados sensíveis
  - Registrar todas as operações de conexão/desconexão
  - Implementar rastreamento de mudanças em configurações
  - _Requirements: 2.1, 2.2_



- [x] 13. Otimização e cache




- [x] 13.1 Implementar cache de métricas

  - Configurar Redis ou similar para cache
  - Implementar cache de campanhas (TTL: 5 min)
  - Implementar cache de métricas (TTL: 15 min)
  - Implementar cache de dados agregados (TTL: 10 min)
  - Adicionar invalidação de cache em syncs
  - _Requirements: 9.2, 9.3_


- [x] 13.2 Otimizar queries do banco

  - Revisar e otimizar queries complexas
  - Adicionar índices adicionais se necessário
  - Implementar paginação eficiente
  - Otimizar agregações multi-plataforma
  - _Requirements: 7.1, 8.1_

- [x] 13.3 Implementar batch operations


  - Otimizar sync para processar em batches
  - Implementar bulk insert de métricas
  - Adicionar processamento paralelo quando possível
  - _Requirements: 3.1, 3.2_



- [x] 14. Testes de integração e E2E



- [x] 14.1 Criar testes de integração


  - Testar fluxo completo de OAuth
  - Testar sincronização end-to-end
  - Testar isolamento de dados entre clientes
  - Testar agregação multi-plataforma
  - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [x] 14.2 Criar testes E2E


  - Testar conexão de conta Google Ads
  - Testar visualização de campanhas
  - Testar dashboard unificado
  - Testar exportação de dados
  - _Requirements: 1.1, 4.1, 5.1, 12.1_



- [x] 14.3 Testes de compatibilidade















  - Validar que funcionalidades Meta não foram afetadas
  - Testar sistema com apenas Meta conectado
  - Testar sistema com apenas Google conectado
  - Testar sistema com ambas plataformas
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_


- [x] 15. Documentação e migração













- [-] 15. Documentação e migração



- [x] 15.1 Criar documentação técnica


  - Documentar APIs do Google Ads
  - Documentar schema do banco de dados
  - Criar guia de troubleshooting
  - Documentar variáveis de ambiente necessárias
  - _Requirements: 1.1, 2.1_



- [x] 15.2 Criar documentação de usuário

  - Criar guia de conexão Google Ads
  - Documentar funcionalidades do dashboard
  - Criar FAQ de problemas comuns
  - Adicionar screenshots e exemplos
  - _Requirements: 1.1, 4.1, 7.1_




- [x] 15.3 Preparar migração


  - Criar script de aplicação do schema
  - Preparar rollback plan
  - Criar checklist de deploy
  - Documentar processo de configuração inicial
  - _Requirements: 1.1, 2.1_



- [x] 16. Deploy e validação final

- [x] 16. Deploy e validação final

- [x] 16.1 Deploy em staging

  - Aplicar schema do banco de dados
  - Configurar variáveis de ambiente
  - Deploy do código
  - Executar testes de smoke
  - _Requirements: 1.1, 2.1_


- [x] 16.2 Validação em staging

  - Testar fluxo completo de conexão
  - Validar sincronização de dados
  - Testar todos os dashboards
  - Validar exportação de dados
  - Verificar logs e monitoring
  - _Requirements: 1.1, 3.1, 4.1, 5.1, 12.1_

- [x] 16.3 Deploy em produção


  - Aplicar schema em produção
  - Deploy do código
  - Monitorar logs e métricas
  - Validar funcionalidades críticas
  - Comunicar lançamento aos usuários
  - _Requirements: 1.1, 2.1, 11.1_
