# Google Ads Integration - Deployment Checklist

## Overview

Este checklist garante que todos os aspectos da integração Google Ads sejam verificados antes, durante e após o deployment em produção.

## Pré-Deployment

### 1. Preparação do Ambiente

#### 1.1 Backup e Segurança
- [ ] Backup completo do banco de dados realizado
- [ ] Backup das configurações atuais salvo
- [ ] Plano de rollback documentado e testado
- [ ] Janela de manutenção agendada (se necessário)

#### 1.2 Verificações de Sistema
- [ ] Script de pré-migração executado com sucesso
  ```bash
  node scripts/pre-migration-check.js
  ```
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Conectividade com Supabase verificada
- [ ] Permissões de admin confirmadas

#### 1.3 Configuração Google Cloud
- [ ] Projeto Google Cloud configurado
- [ ] Google Ads API habilitada
- [ ] OAuth 2.0 credentials criados
- [ ] Redirect URIs configurados para produção
- [ ] Developer Token aprovado (ou em modo básico para testes)

### 2. Validação de Código

#### 2.1 Testes
- [ ] Testes unitários passando
  ```bash
  npm run test
  ```
- [ ] Testes de integração passando
  ```bash
  npm run test:integration
  ```
- [ ] Testes E2E executados em staging
  ```bash
  npm run test:e2e
  ```

#### 2.2 Code Review
- [ ] Code review completo realizado
- [ ] Documentação técnica atualizada
- [ ] Changelog atualizado
- [ ] Versão taggeada no Git

### 3. Staging Validation

#### 3.1 Deploy Staging
- [ ] Deploy em ambiente de staging realizado
- [ ] Schema aplicado em staging
- [ ] Variáveis de ambiente configuradas em staging
- [ ] Health checks passando em staging

#### 3.2 Testes Funcionais
- [ ] OAuth flow testado
- [ ] Conexão de conta Google Ads testada
- [ ] Sincronização de campanhas testada
- [ ] Dashboard Google Ads funcionando
- [ ] Dashboard unificado funcionando
- [ ] Exportação de dados testada
- [ ] Isolamento de dados verificado

## Deployment

### 1. Aplicação do Schema

#### 1.1 Migração do Banco
- [ ] Script de migração executado
  ```bash
  node scripts/apply-google-ads-complete-migration.js
  ```
- [ ] Verificação de integridade passou
- [ ] RLS policies ativas
- [ ] Índices criados com sucesso
- [ ] Funções auxiliares instaladas

#### 1.2 Verificação Pós-Schema
- [ ] Todas as tabelas criadas
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name LIKE 'google_ads_%';
  ```
- [ ] Políticas RLS ativas
  ```sql
  SELECT tablename, policyname FROM pg_policies 
  WHERE tablename LIKE 'google_ads_%';
  ```
- [ ] Índices de performance criados
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename LIKE 'google_ads_%';
  ```

### 2. Deploy da Aplicação

#### 2.1 Vercel Deploy
- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Deploy para produção executado
  ```bash
  vercel --prod
  ```
- [ ] Build completado sem erros
- [ ] Deploy URL confirmada

#### 2.2 Configuração Pós-Deploy
- [ ] Cron jobs configurados no Vercel
- [ ] Health check endpoint respondendo
  ```bash
  curl https://your-domain.com/api/google/monitoring/health
  ```
- [ ] DNS e domínio funcionando corretamente

### 3. Configuração de Monitoramento

#### 3.1 Alertas
- [ ] Alertas de sync failure configurados
- [ ] Alertas de rate limit configurados
- [ ] Alertas de token expiration configurados
- [ ] Notificações de admin configuradas

#### 3.2 Logs
- [ ] Logs estruturados funcionando
- [ ] Níveis de log configurados adequadamente
- [ ] Retenção de logs configurada

## Pós-Deployment

### 1. Verificação Imediata

#### 1.1 Health Checks
- [ ] API de saúde respondendo
  ```bash
  curl https://your-domain.com/api/google/monitoring/health
  ```
- [ ] Banco de dados acessível
- [ ] Todas as rotas Google Ads funcionando

#### 1.2 Funcionalidade Básica
- [ ] Página de login carregando
- [ ] Dashboard principal funcionando
- [ ] Menu de navegação atualizado
- [ ] Links para Google Ads funcionando

### 2. Testes de Aceitação

#### 2.1 Fluxo Completo
- [ ] Usuário consegue fazer login
- [ ] Usuário consegue acessar dashboard
- [ ] Botão "Conectar Google Ads" visível
- [ ] OAuth flow funciona completamente
- [ ] Conta Google Ads conecta com sucesso
- [ ] Sincronização inicial executa
- [ ] Campanhas aparecem no dashboard
- [ ] Métricas são exibidas corretamente

#### 2.2 Dashboard Unificado
- [ ] Dashboard principal mostra dados consolidados
- [ ] Comparação entre plataformas funciona
- [ ] Filtros de data funcionam
- [ ] Exportação funciona

### 3. Testes de Isolamento

#### 3.1 Multi-Cliente
- [ ] Múltiplos clientes podem conectar Google Ads
- [ ] Dados ficam isolados entre clientes
- [ ] RLS funciona corretamente
- [ ] Não há vazamento de dados

#### 3.2 Compatibilidade
- [ ] Funcionalidades Meta Ads não foram afetadas
- [ ] Clientes com apenas Meta continuam funcionando
- [ ] Clientes com apenas Google funcionam
- [ ] Clientes com ambas plataformas funcionam

### 4. Performance e Monitoramento

#### 4.1 Performance
- [ ] Tempos de resposta dentro do esperado
- [ ] Queries do banco otimizadas
- [ ] Cache funcionando adequadamente
- [ ] Sem memory leaks detectados

#### 4.2 Monitoramento
- [ ] Métricas sendo coletadas
- [ ] Dashboards de monitoramento funcionando
- [ ] Alertas testados
- [ ] Logs sendo gerados corretamente

## Validação de Produção

### 1. Testes com Dados Reais

#### 1.1 Conexão Real
- [ ] Conta Google Ads real conectada
- [ ] Campanhas reais sincronizadas
- [ ] Métricas reais exibidas
- [ ] Dados históricos importados

#### 1.2 Operações Críticas
- [ ] Sync automático funcionando
- [ ] Sync manual funcionando
- [ ] Refresh de tokens funcionando
- [ ] Tratamento de erros funcionando

### 2. Testes de Carga

#### 2.1 Volume
- [ ] Múltiplas contas conectadas simultaneamente
- [ ] Sync de muitas campanhas testado
- [ ] Performance com dados históricos testada
- [ ] Concurrent users testado

#### 2.2 Limites
- [ ] Rate limiting funcionando
- [ ] Timeouts configurados adequadamente
- [ ] Retry logic funcionando
- [ ] Graceful degradation testada

### 3. Segurança

#### 3.1 Autenticação
- [ ] OAuth flow seguro
- [ ] Tokens criptografados
- [ ] State parameter validado
- [ ] CSRF protection ativa

#### 3.2 Autorização
- [ ] RLS policies funcionando
- [ ] Isolamento de dados verificado
- [ ] Permissões adequadas
- [ ] Audit logs funcionando

## Rollback Plan

### Critérios para Rollback

Execute rollback se:
- [ ] Taxa de erro > 10% por 15 minutos
- [ ] Funcionalidades críticas não funcionam
- [ ] Vazamento de dados detectado
- [ ] Performance degradada significativamente
- [ ] Impossibilidade de conectar novas contas

### Procedimento de Rollback

#### 1. Rollback Imediato
```bash
# 1. Rollback do código
vercel rollback

# 2. Rollback do banco (se necessário)
node scripts/rollback-google-ads-migration.js

# 3. Verificar sistema
curl https://your-domain.com/api/health
```

#### 2. Comunicação
- [ ] Equipe notificada sobre rollback
- [ ] Usuários notificados (se necessário)
- [ ] Status page atualizado
- [ ] Incident report iniciado

## Pós-Rollback

### Se Rollback Foi Necessário

#### 1. Investigação
- [ ] Logs analisados
- [ ] Causa raiz identificada
- [ ] Fix implementado
- [ ] Testes adicionais criados

#### 2. Re-deployment
- [ ] Fix validado em staging
- [ ] Novo deployment planejado
- [ ] Checklist re-executado
- [ ] Monitoramento reforçado

## Comunicação

### Stakeholders

#### 1. Equipe Técnica
- [ ] Desenvolvedores notificados sobre deploy
- [ ] DevOps informado sobre mudanças
- [ ] QA informado sobre novas funcionalidades

#### 2. Usuários
- [ ] Release notes publicadas
- [ ] Documentação de usuário atualizada
- [ ] Suporte informado sobre novas funcionalidades
- [ ] Treinamento realizado (se necessário)

### Documentação

#### 1. Técnica
- [ ] Documentação técnica atualizada
- [ ] Troubleshooting guide atualizado
- [ ] Runbooks atualizados
- [ ] Monitoring playbooks atualizados

#### 2. Usuário
- [ ] Guias de usuário atualizados
- [ ] FAQ atualizado
- [ ] Screenshots atualizados
- [ ] Vídeos tutoriais criados (se necessário)

## Métricas de Sucesso

### KPIs Técnicos

#### 1. Performance
- [ ] Tempo de resposta < 2s para dashboards
- [ ] Sync completo < 10 minutos
- [ ] Taxa de sucesso de sync > 95%
- [ ] Uptime > 99.9%

#### 2. Funcionalidade
- [ ] Taxa de sucesso OAuth > 98%
- [ ] Taxa de erro de API < 2%
- [ ] Zero vazamentos de dados
- [ ] Zero regressões em funcionalidades existentes

### KPIs de Negócio

#### 1. Adoção
- [ ] % de clientes que conectam Google Ads
- [ ] Tempo médio para primeira conexão
- [ ] Retenção de conexões ativas
- [ ] Satisfação do usuário

#### 2. Valor
- [ ] Aumento no engagement do dashboard
- [ ] Redução em tickets de suporte
- [ ] Aumento na utilização de insights
- [ ] ROI da integração

## Sign-off

### Aprovações Necessárias

- [ ] **Tech Lead**: Aspectos técnicos aprovados
- [ ] **DevOps**: Infraestrutura e deploy aprovados  
- [ ] **QA**: Testes e qualidade aprovados
- [ ] **Product**: Funcionalidades e UX aprovados
- [ ] **Security**: Aspectos de segurança aprovados

### Final Checklist

- [ ] Todos os itens deste checklist foram verificados
- [ ] Documentação completa e atualizada
- [ ] Monitoramento ativo e funcionando
- [ ] Equipe treinada e preparada para suporte
- [ ] Plano de rollback testado e documentado

---

**Data do Deploy**: _______________  
**Versão**: _______________  
**Responsável**: _______________  
**Aprovado por**: _______________

---

**Notas Adicionais**:
_Use este espaço para documentar qualquer observação específica do deploy, problemas encontrados, ou desvios do processo padrão._