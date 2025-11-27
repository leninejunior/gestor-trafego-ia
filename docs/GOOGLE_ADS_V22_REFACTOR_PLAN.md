# Plano de Refatoração Google Ads API v22

## Análise da Documentação

### Mudanças Principais v21 → v22

1. **Batch Jobs - Novos Limites**
   - Limite de 10.000 operações por `AddBatchJobOperations`
   - `page_size` padrão agora é 1.000 (antes retornava erro)
   - `page_size` > 1.000 retorna `INVALID_PAGE_SIZE`

2. **Métricas de Vídeo Renomeadas**
   - `average_cpv` → `trueview_average_cpv`
   - `video_view_rate` → `video_trueview_view_rate`
   - `video_views` → `video_trueview_views`
   - Variantes `_in_feed`, `_in_stream`, `_shorts` também renomeadas

3. **Performance Max**
   - `AssetPerformanceLabel` removido
   - `Campaign.url_expansion_opt_out` removido
   - Usar `AssetAutomationType.FINAL_URL_EXPANSION_TEXT_ASSET_AUTOMATION`

4. **ReachPlanService**
   - Campo `trueview_views` substitui `views`

5. **Correção de Typo**
   - `minimum_bugdet_amount_micros` → `minimum_budget_amount_micros`

### Novos Recursos v22

1. **Campaign Goal Config** (novo serviço)
2. **Goal Service** (novo serviço)
3. **Asset Generation Service** (IA generativa)
4. **Targeting Expansion View** (novo recurso)

## Estado Atual da Implementação

### ✅ Pontos Fortes

1. **Arquitetura Bem Estruturada**
   - `GoogleOAuthFlowManager` centraliza fluxo OAuth
   - `GoogleTokenManager` gerencia tokens com criptografia
   - `GoogleAdsClient` abstrai chamadas à API
   - Separação clara de responsabilidades

2. **Segurança**
   - Tokens criptografados no banco
   - Refresh automático de tokens
   - Validação de state OAuth
   - Audit logging implementado

3. **Fluxo OAuth Completo**
   - Iniciação → Callback → Listagem → Seleção
   - Suporte a múltiplas contas
   - Validação de acesso por cliente

### ⚠️ Pontos de Atenção

1. **Versão da API**
   - Código usa `v22` (correto)
   - Mas não aproveita novos recursos

2. **Listagem de Contas**
   - Método `listAccessibleCustomers()` correto
   - Usa GET conforme documentação
   - Mas tratamento de erro pode melhorar

3. **Queries GAQL**
   - Não usa métricas renomeadas do v22
   - Pode adicionar novos campos disponíveis

4. **Paginação**
   - Não implementa paginação em queries
   - Pode atingir limites em contas grandes

## Plano de Refatoração

### Fase 1: Atualização de Métricas (Crítico)

**Objetivo**: Atualizar queries para usar nomes corretos v22

**Arquivos Afetados**:
- `src/lib/google/client.ts`
- `src/lib/google/sync-service.ts`
- `src/lib/types/google-ads.ts`

**Mudanças**:
```typescript
// ANTES (v21)
metrics.average_cpv
metrics.video_view_rate
metrics.video_views

// DEPOIS (v22)
metrics.trueview_average_cpv
metrics.video_trueview_view_rate
metrics.video_trueview_views
```

### Fase 2: Melhorias na Listagem de Contas

**Objetivo**: Tornar listagem mais robusta e informativa

**Melhorias**:
1. Adicionar retry logic para falhas temporárias
2. Melhorar mensagens de erro
3. Adicionar cache de contas (5 minutos)
4. Paralelizar busca de detalhes das contas
5. Adicionar filtros (apenas contas gerenciáveis, etc)

### Fase 3: Implementar Paginação

**Objetivo**: Suportar contas com muitas campanhas

**Implementação**:
1. Adicionar suporte a `page_token` em queries
2. Implementar método `searchStreamPaginated()`
3. Respeitar limite de 1.000 por página
4. Adicionar opção de busca incremental

### Fase 4: Novos Recursos v22 (Opcional)

**Recursos a Considerar**:
1. **Campaign Goal Config**: Configurar objetivos de campanha
2. **Asset Generation**: Gerar assets com IA
3. **Targeting Expansion View**: Insights de expansão

### Fase 5: Otimizações de Performance

**Melhorias**:
1. Batch requests quando possível
2. Cache de resultados frequentes
3. Compressão de respostas grandes
4. Lazy loading de métricas detalhadas

## Prioridades de Implementação

### 🔴 Alta Prioridade (Fazer Agora)

1. ✅ Atualizar métricas de vídeo para v22
2. ✅ Melhorar tratamento de erros em `listAccessibleCustomers()`
3. ✅ Adicionar validação de Developer Token
4. ✅ Documentar requisitos de configuração

### 🟡 Média Prioridade (Próximas Sprints)

1. Implementar paginação em queries grandes
2. Adicionar cache de contas acessíveis
3. Paralelizar busca de detalhes
4. Adicionar retry logic robusto

### 🟢 Baixa Prioridade (Futuro)

1. Explorar Asset Generation Service
2. Implementar Campaign Goal Config
3. Adicionar Targeting Expansion insights
4. Otimizar batch operations

## Checklist de Validação

### Antes de Deploy

- [ ] Todas as queries GAQL atualizadas para v22
- [ ] Testes de listagem de contas funcionando
- [ ] Tratamento de erro para Developer Token inválido
- [ ] Documentação atualizada
- [ ] Logs de debug removidos ou configuráveis
- [ ] Variáveis de ambiente documentadas

### Após Deploy

- [ ] Monitorar logs de erro da API
- [ ] Verificar taxa de sucesso de OAuth
- [ ] Validar refresh automático de tokens
- [ ] Confirmar listagem de contas em produção
- [ ] Testar com múltiplas contas

## Riscos e Mitigações

### Risco 1: Developer Token Não Aprovado
**Impacto**: Alto - API retorna HTML em vez de JSON
**Mitigação**: 
- Validar token antes de usar
- Mensagem clara para usuário
- Documentar processo de aprovação

### Risco 2: Contas MCC Complexas
**Impacto**: Médio - Hierarquia de contas pode confundir
**Mitigação**:
- Filtrar apenas contas gerenciáveis
- Mostrar hierarquia visualmente
- Permitir seleção de MCC ou sub-contas

### Risco 3: Rate Limits
**Impacto**: Médio - Muitas requisições podem ser bloqueadas
**Mitigação**:
- Implementar exponential backoff
- Cache agressivo de resultados
- Batch requests quando possível

### Risco 4: Tokens Expirados
**Impacto**: Baixo - Já temos refresh automático
**Mitigação**:
- Monitorar taxa de falha de refresh
- Alertar usuário para reconectar
- Limpar conexões inválidas

## Métricas de Sucesso

1. **Taxa de Sucesso OAuth**: > 95%
2. **Tempo de Listagem de Contas**: < 5 segundos
3. **Taxa de Refresh de Token**: > 99%
4. **Erros de API**: < 1% das requisições
5. **Satisfação do Usuário**: Feedback positivo

## Próximos Passos

1. ✅ Criar este documento de planejamento
2. 🔄 Implementar Fase 1 (atualização de métricas)
3. 🔄 Implementar Fase 2 (melhorias na listagem)
4. ⏳ Testar em ambiente de desenvolvimento
5. ⏳ Deploy gradual em produção
6. ⏳ Monitorar e iterar

## Referências

- [Google Ads API v22 Overview](https://developers.google.com/google-ads/api/reference/rpc/v22/overview)
- [Upgrade Guide v21→v22](https://developers.google.com/google-ads/api/docs/upgrade#v21-v22)
- [Google Ads API Best Practices](https://developers.google.com/google-ads/api/docs/best-practices)
- [OAuth 2.0 for Google APIs](https://developers.google.com/identity/protocols/oauth2)

---

**Documento criado em**: 2025-11-20  
**Última atualização**: 2025-11-20  
**Status**: 🔄 Em Progresso
