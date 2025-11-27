# Google Ads API v22 - Checklist de Deployment

## 📋 Pré-Deployment

### 1. Configuração do Google Cloud Console

- [ ] Projeto criado no Google Cloud Console
- [ ] Google Ads API habilitada
- [ ] Tela de consentimento OAuth configurada
- [ ] Credenciais OAuth 2.0 criadas
- [ ] URIs de redirecionamento configurados:
  - [ ] Desenvolvimento: `http://localhost:3000/api/google/callback`
  - [ ] Produção: `https://seu-dominio.com/api/google/callback`
- [ ] Escopos adicionados: `https://www.googleapis.com/auth/adwords`

### 2. Developer Token

- [ ] Developer Token solicitado em https://ads.google.com/aw/apicenter
- [ ] Token de teste obtido (para desenvolvimento)
- [ ] Token de produção aprovado (para produção)
- [ ] Limites de API verificados

### 3. Variáveis de Ambiente

#### Desenvolvimento (.env)
- [ ] `GOOGLE_CLIENT_ID` configurado
- [ ] `GOOGLE_CLIENT_SECRET` configurado
- [ ] `GOOGLE_ADS_DEVELOPER_TOKEN` configurado (teste)
- [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3000`

#### Produção (.env.production)
- [ ] `GOOGLE_CLIENT_ID` configurado
- [ ] `GOOGLE_CLIENT_SECRET` configurado
- [ ] `GOOGLE_ADS_DEVELOPER_TOKEN` configurado (produção)
- [ ] `NEXT_PUBLIC_APP_URL=https://seu-dominio.com`

### 4. Banco de Dados

- [ ] Schema executado: `database/google-ads-schema.sql`
- [ ] Tabelas criadas:
  - [ ] `google_ads_connections`
  - [ ] `google_ads_campaigns`
  - [ ] `google_ads_metrics`
  - [ ] `google_ads_sync_logs`
- [ ] RLS policies habilitadas
- [ ] Índices criados
- [ ] Funções helper criadas

### 5. Validação da Implementação

- [ ] Script de validação executado: `npm run validate:google-ads-v22`
- [ ] Taxa de conformidade >= 80%
- [ ] Todos os arquivos principais presentes
- [ ] Headers obrigatórios implementados
- [ ] OAuth scopes corretos
- [ ] Versão da API = v22

## 🧪 Testes

### Testes Locais

- [ ] OAuth flow testado com sucesso
- [ ] Listagem de contas funcionando
- [ ] Seleção de contas funcionando
- [ ] Sincronização de campanhas funcionando
- [ ] Métricas sendo coletadas
- [ ] Refresh de tokens automático
- [ ] Error handling testado

### Testes de Integração

- [ ] Teste com conta real do Google Ads
- [ ] Teste com múltiplas contas
- [ ] Teste com conta MCC (se aplicável)
- [ ] Teste de sincronização completa
- [ ] Teste de rate limiting
- [ ] Teste de token expiration

### Testes de Segurança

- [ ] Tokens criptografados no banco
- [ ] RLS policies funcionando
- [ ] Auditoria registrando operações
- [ ] Sem tokens em logs
- [ ] HTTPS em produção

## 🚀 Deployment

### Staging

- [ ] Deploy em ambiente de staging
- [ ] Variáveis de ambiente configuradas
- [ ] Testes smoke executados
- [ ] OAuth flow validado
- [ ] Sincronização testada
- [ ] Monitoramento configurado

### Produção

- [ ] Developer Token de produção aprovado
- [ ] Variáveis de ambiente de produção configuradas
- [ ] URIs de redirecionamento atualizados no Google Cloud
- [ ] Deploy em produção executado
- [ ] Health checks passando
- [ ] Monitoramento ativo
- [ ] Alertas configurados

## 📊 Pós-Deployment

### Monitoramento

- [ ] Dashboard de métricas acessível
- [ ] Logs sendo coletados
- [ ] Alertas funcionando
- [ ] Performance dentro do esperado
- [ ] Rate limits monitorados

### Documentação

- [ ] README atualizado
- [ ] Guia de troubleshooting disponível
- [ ] Runbook de operações criado
- [ ] Contatos de suporte documentados

### Comunicação

- [ ] Time notificado sobre o deploy
- [ ] Usuários informados sobre nova feature
- [ ] Documentação de usuário disponível
- [ ] Suporte preparado para dúvidas

## 🔍 Validação Pós-Deploy

### Funcionalidades Críticas

- [ ] Usuários conseguem conectar contas Google Ads
- [ ] Listagem de contas funcionando
- [ ] Sincronização de campanhas ativa
- [ ] Métricas sendo exibidas corretamente
- [ ] Refresh de tokens automático
- [ ] Desconexão de contas funcionando

### Performance

- [ ] Tempo de resposta da API < 2s
- [ ] Taxa de sucesso de sync > 95%
- [ ] Taxa de sucesso de refresh > 99%
- [ ] Sem memory leaks
- [ ] Sem rate limit exceeded

### Segurança

- [ ] Tokens criptografados
- [ ] RLS funcionando
- [ ] Auditoria ativa
- [ ] HTTPS obrigatório
- [ ] Headers de segurança configurados

## 🚨 Rollback Plan

### Critérios para Rollback

- [ ] Taxa de erro > 10%
- [ ] Performance degradada > 50%
- [ ] Falha crítica de segurança
- [ ] Impossibilidade de conectar contas
- [ ] Perda de dados

### Procedimento de Rollback

1. [ ] Notificar time
2. [ ] Executar rollback do deploy
3. [ ] Verificar funcionalidades básicas
4. [ ] Notificar usuários (se necessário)
5. [ ] Investigar causa raiz
6. [ ] Planejar correção

## 📝 Checklist de Operações

### Diário

- [ ] Verificar logs de erro
- [ ] Verificar métricas de performance
- [ ] Verificar alertas
- [ ] Verificar taxa de sucesso de sync

### Semanal

- [ ] Revisar logs de auditoria
- [ ] Analisar tendências de uso
- [ ] Verificar health das conexões
- [ ] Limpar dados antigos (se aplicável)

### Mensal

- [ ] Revisar e otimizar queries
- [ ] Atualizar documentação
- [ ] Revisar políticas de segurança
- [ ] Planejar melhorias

## 🆘 Contatos de Emergência

### Google Ads API

- **Forum:** https://groups.google.com/g/adwords-api
- **Stack Overflow:** Tag `google-ads-api`
- **Suporte:** Via Google Cloud Console

### Interno

- **Tech Lead:** [Nome/Email]
- **DevOps:** [Nome/Email]
- **Suporte:** [Nome/Email]

## 📚 Recursos

### Documentação

- [Implementação Completa](./GOOGLE_ADS_V22_IMPLEMENTATION.md)
- [Guia de Setup](./GOOGLE_ADS_V22_SETUP_GUIDE.md)
- [Referência Rápida](./GOOGLE_ADS_V22_QUICK_REFERENCE.md)
- [README](./GOOGLE_ADS_V22_README.md)

### Links Úteis

- **Google Ads API:** https://developers.google.com/google-ads/api/docs/start
- **OAuth Guide:** https://developers.google.com/google-ads/api/docs/oauth/overview
- **API Reference:** https://developers.google.com/google-ads/api/rest/reference

## ✅ Sign-off

### Aprovações Necessárias

- [ ] Tech Lead
- [ ] DevOps
- [ ] Security Team
- [ ] Product Owner

### Confirmação Final

- [ ] Todos os itens do checklist verificados
- [ ] Testes passando
- [ ] Documentação completa
- [ ] Time preparado
- [ ] Rollback plan definido

**Data do Deploy:** _______________  
**Responsável:** _______________  
**Aprovado por:** _______________

---

**Versão:** v22  
**Última atualização:** 2024-01-20
