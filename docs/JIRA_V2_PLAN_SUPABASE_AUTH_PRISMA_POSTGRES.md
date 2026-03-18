# Plano Jira - V2 (Supabase Auth + Prisma + Postgres em VPS)

## 1) Decisao Arquitetural
- Manter o sistema atual em producao sem alteracoes estruturais.
- Criar V2 em projeto separado (recomendado) ou monorepo em `apps/v2`.
- Manter `Supabase Auth` no cloud.
- Migrar dados de negocio para `Postgres` na VPS com `Prisma`.

## 2) Recomendacao de Estrutura
- Opcao recomendada: novo repositorio `flying-fox-v2`.
- Motivo: reduz conflito com hotfix do sistema atual e simplifica CI/CD.
- Alternativa: branch longa neste repo (nao recomendado para execucao completa da V2).

## 3) Epicos e Issues (modelo Jira)

## EPIC V2-ARCH - Fundacao da V2
### V2-1 (Story) - Criar projeto base V2
- Tamanho: P
- Entrega:
- Next.js + TypeScript
- Prisma configurado
- Docker Compose com Postgres local
- Definition of Done:
- `docker compose up -d` sobe Postgres
- `prisma migrate dev` executa sem erro
- app inicia com `npm run dev`

### V2-2 (Task) - Configurar ambientes e secrets
- Tamanho: P
- Entrega:
- `.env.example` da V2
- variaveis para `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`
- Definition of Done:
- checklist de variaveis por ambiente (dev/staging/prod)

## EPIC V2-AUTH - Autenticacao e Sessao
### V2-3 (Story) - Integrar Supabase Auth na V2
- Tamanho: M
- Entrega:
- login/logout
- leitura de sessao via JWT
- guardas de rota autenticadas
- Definition of Done:
- usuario logado acessa rotas privadas
- usuario anonimo recebe 401/redirect

### V2-4 (Task) - Provisionamento no primeiro login
- Tamanho: M
- Entrega:
- criar/atualizar `users` no Postgres V2 usando `auth.users.id` como chave
- Definition of Done:
- primeiro login cria usuario local sem duplicidade

## EPIC V2-DATA - Modelo de Dados e Prisma
### V2-5 (Story) - Modelagem inicial do dominio core
- Tamanho: M
- Escopo:
- organizations
- memberships
- clients
- meta_connections
- campaigns (snapshot inicial)
- Definition of Done:
- schema Prisma versionado
- migracoes aplicadas em dev

### V2-6 (Task) - Repositorios Prisma para dominio core
- Tamanho: M
- Entrega:
- camada de acesso a dados sem supabase-js para entidades core
- Definition of Done:
- CRUD basico coberto por testes unitarios

## EPIC V2-MIG - Migracao de Dados
### V2-7 (Story) - Carga inicial (full load) da base atual para V2
- Tamanho: M
- Entrega:
- script ETL idempotente
- mapeamento de IDs e auditoria de inconsistencias
- Definition of Done:
- carga executa e gera relatorio de reconciliacao

### V2-8 (Story) - Sincronizacao incremental (delta)
- Tamanho: G
- Entrega:
- rotina de sync por timestamp/changelog
- retry e logs de erro
- Definition of Done:
- delta roda sem duplicar dados

## EPIC V2-REPORT - Relatorios e Disparos
### V2-9 (Story) - Motor de relatorio diario (Meta)
- Tamanho: M
- Entrega:
- consolidacao de metricas (alcance, impressoes, ctr, cpc, cpm, leads, investimento)
- template padrao de mensagem
- Definition of Done:
- endpoint retorna payload final pronto para envio

### V2-10 (Story) - Integracao Papi para envio em grupos
- Tamanho: M
- Entrega:
- client Papi
- envio para grupo
- logs de envio/erro
- Definition of Done:
- endpoint de teste envia para grupo configurado

## EPIC V2-OPS - Infra e Operacao na VPS
### V2-11 (Story) - Deploy V2 na VPS
- Tamanho: M
- Entrega:
- Dockerfile
- compose/proxy
- variaveis seguras
- healthcheck
- Definition of Done:
- V2 acessivel em URL de staging

### V2-12 (Task) - Backups e restore do Postgres VPS
- Tamanho: M
- Entrega:
- job de backup diario
- procedimento de restore documentado
- Definition of Done:
- restore testado em ambiente de homologacao

## EPIC V2-QA - Qualidade e Cutover
### V2-13 (Story) - Testes de paridade V1 vs V2
- Tamanho: G
- Entrega:
- testes comparando KPIs chave entre V1 e V2
- Definition of Done:
- diferenca maxima aceitavel definida e validada

### V2-14 (Story) - Cutover gradual com rollback
- Tamanho: M
- Entrega:
- feature flag por cliente/grupo
- plano de rollback em 1 comando
- Definition of Done:
- primeiro grupo piloto operando na V2 com rollback pronto

## EPIC V2-AI - API de Acesso para IA (Leitura)
### V2-15 (Story) - API unificada de leitura de campanhas para IA
- Tamanho: M
- Escopo:
- endpoint read-only para consolidar dados de campanhas (Meta + Google)
- filtros por `organizationId`, `clientId`, `platform`, `dateFrom`, `dateTo`
- paginacao e ordenacao estavel para consumo por agente IA
- Definition of Done:
- endpoint `GET /api/v2/ai/campaigns` documentado e com contrato estavel
- resposta inclui dados normalizados de campanha e KPIs principais
- API nao permite operacoes de escrita (somente leitura)

### V2-16 (Task) - Seguranca e governanca da API da IA
- Tamanho: M
- Entrega:
- autenticacao por token de servico com escopo `ai:read_campaigns`
- rate limiting por organizacao/chave
- trilha de auditoria de chamadas (quem acessou, quando, e qual filtro)
- Definition of Done:
- chamadas sem escopo valido retornam `403`
- auditoria registrada por requisicao com `organization_id`
- limites de taxa ativos e testados

### V2-17 (Task) - Endpoint de contexto para IA (resumo executivo)
- Tamanho: P
- Entrega:
- endpoint com resumo consolidado (investimento, leads, CTR, CPC, CPM, ROAS)
- comparativo periodo atual vs periodo anterior
- flags de anomalia basicas (queda/aumento abrupto)
- Definition of Done:
- endpoint `GET /api/v2/ai/context-summary` retorna payload pronto para LLM
- teste de contrato garantindo formato consistente

## 4) Sequencia Recomendada (Sprint inicial)
1. V2-1
2. V2-2
3. V2-3
4. V2-4
5. V2-5
6. V2-6

## 5) Escopo da Primeira Issue para comecar agora
- Issue sugerida: `V2-1 - Criar projeto base V2`.
- Entrega isolada, testavel e reversivel.
