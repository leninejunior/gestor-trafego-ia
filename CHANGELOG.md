# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

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
