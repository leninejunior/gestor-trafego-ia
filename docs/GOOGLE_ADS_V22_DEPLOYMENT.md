# 🚀 Guia de Deploy - Google Ads API v22

**Data**: 19 de Novembro de 2025  
**Versão**: v22  
**Status**: Pronto para Deploy

---

## 📋 Pré-Deploy Checklist

### 1. Validação Local
```bash
# Executar script de validação
node scripts/test-google-ads-v22.js

# Esperado: ✅ Migração para v22 concluída com sucesso!
```

### 2. Build
```bash
# Fazer build do projeto
npm run build

# Esperado: Build concluído sem erros
```

### 3. Lint
```bash
# Verificar código
npm run lint

# Esperado: Sem erros de linting
```

### 4. Testes
```bash
# Executar testes
npm run test

# Esperado: Todos os testes passando
```

---

## 🔄 Processo de Deploy

### Opção 1: Deploy em Staging (Recomendado)

```bash
# 1. Fazer deploy em staging
npm run deploy:staging

# 2. Validar em staging
npm run validate:staging

# 3. Executar testes E2E
npm run test:e2e:staging

# 4. Gerar relatório
npm run report:staging
```

### Opção 2: Deploy em Produção

```bash
# 1. Fazer deploy em produção
npm run deploy

# 2. Monitorar logs
npm run monitor:production

# 3. Executar smoke tests
npm run smoke-tests
```

---

## 🧪 Testes Pós-Deploy

### 1. Teste de Conexão
```bash
# Acessar endpoint de teste
curl -X GET "https://seu-app.com/api/google/check-api-status"

# Esperado: { success: true, version: 'v22' }
```

### 2. Teste de Sincronização
```bash
# Acessar página de campanhas
# Verificar se as campanhas são carregadas
# Validar que os dados estão corretos
```

### 3. Teste de Insights
```bash
# Acessar página de analytics
# Selecionar um período de datas
# Verificar se os insights são carregados
```

### 4. Monitorar Logs
```bash
# Verificar logs de erro
tail -f logs/error.log | grep "Google Ads"

# Esperado: Nenhum erro relacionado a v18
```

---

## 📊 Métricas de Sucesso

| Métrica | Esperado | Crítico |
|---------|----------|---------|
| Taxa de Sucesso | > 99% | < 95% |
| Tempo de Resposta | < 2s | > 5s |
| Taxa de Erro | < 1% | > 5% |
| Disponibilidade | > 99.9% | < 99% |

---

## 🚨 Plano de Rollback

Se houver problemas críticos:

### 1. Identificar Problema
```bash
# Verificar logs
tail -f logs/error.log

# Verificar métricas
curl -X GET "https://seu-app.com/api/health"
```

### 2. Fazer Rollback
```bash
# Reverter para versão anterior
git revert <commit-hash>

# Fazer deploy
npm run deploy

# Monitorar
npm run monitor:production
```

### 3. Investigar
```bash
# Analisar logs
grep "Google Ads" logs/error.log

# Contatar suporte
# Abrir issue no GitHub
```

---

## 📝 Comunicação

### Antes do Deploy
- [ ] Notificar time sobre migração
- [ ] Compartilhar documentação
- [ ] Agendar reunião de sincronização

### Durante o Deploy
- [ ] Monitorar logs em tempo real
- [ ] Estar disponível para suporte
- [ ] Documentar qualquer problema

### Após o Deploy
- [ ] Confirmar sucesso
- [ ] Atualizar status
- [ ] Arquivar documentação de v18

---

## 🔗 Referências

- [Documentação de Migração](./GOOGLE_ADS_V22_MIGRATION.md)
- [Guia de Validação](./GOOGLE_ADS_V22_VALIDATION.md)
- [Troubleshooting](./GOOGLE_ADS_TROUBLESHOOTING.md)
- [Google Ads API v22 Release Notes](https://developers.google.com/google-ads/api/docs/release-notes)

---

## ✅ Conclusão

Após seguir este guia, o deploy de Google Ads API v22 será bem-sucedido e seguro.

**Tempo Estimado**: 30-60 minutos  
**Risco**: Baixo  
**Impacto**: Nenhum (v18 já estava descontinuada)

---

**Responsável**: DevOps Team  
**Data**: 19 de Novembro de 2025  
**Status**: ✅ PRONTO PARA DEPLOY
