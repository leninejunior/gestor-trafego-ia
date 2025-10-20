# Git Commit - v2.0.0

## 📝 Comandos para Commit

### 1. Verificar Status

```bash
git status
```

### 2. Adicionar Arquivos

```bash
# Adicionar todos os arquivos novos e modificados
git add .

# OU adicionar seletivamente:

# Analytics Multi-Nível
git add src/components/analytics/level-selector.tsx
git add src/components/analytics/adset-comparison.tsx
git add src/components/analytics/ad-comparison.tsx
git add src/components/analytics/creative-thumbnail.tsx
git add src/app/api/analytics/adsets/route.ts
git add src/app/api/analytics/ads/route.ts
git add src/app/dashboard/analytics/page.tsx

# Filtros Avançados
git add src/components/campaigns/campaign-multi-select.tsx
git add src/components/campaigns/custom-date-dialog.tsx
git add src/components/campaigns/date-range-picker.tsx

# Toggle de Campanhas
git add src/app/api/campaigns/[campaignId]/status/route.ts
git add src/app/dashboard/campaigns/page.tsx

# Utilitários
git add src/lib/utils/date-formatter.ts
git add src/lib/types/alerts.ts
git add src/lib/whatsapp/evolution-api.ts

# Banco de Dados
git add database/balance-alerts-schema.sql

# Correções
git add src/components/clients/client-search.tsx
git add src/app/api/dashboard/campaigns/weekly/route.ts

# Documentação
git add RELEASE_NOTES_v2.0.md
git add PLANO_MELHORIAS_ANALYTICS.md
git add IMPLEMENTACAO_COMPLETA_ANALYTICS.md
git add PROGRESSO_MELHORIAS_ANALYTICS.md
git add TOGGLE_CAMPANHAS_IMPLEMENTADO.md
git add TESTAR_AGORA.md
git add GIT_COMMIT_v2.0.md
```

### 3. Commit com Mensagem Detalhada

```bash
git commit -m "feat: Analytics Multi-Nível v2.0.0

✨ Novas Funcionalidades:
- Analytics em 3 níveis (Campanhas, Conjuntos, Anúncios)
- Seleção múltipla de campanhas com busca
- Range de data personalizado com calendários
- Toggle para ativar/pausar campanhas
- Thumbnails de criativos com lightbox
- Sistema de formatação de datas padronizado
- Base para sistema de alertas de saldo

🔧 Melhorias:
- Layout de filtros otimizado
- ClientSearch sem contador prematuro
- Análise semanal com datas formatadas
- Acessibilidade melhorada (DialogTitle)

📊 Componentes Criados:
- LevelSelector, AdSetComparison, AdComparison
- CampaignMultiSelect, CustomDateDialog
- CreativeThumbnail, EvolutionAPIClient

🗄️ APIs Criadas:
- /api/analytics/adsets
- /api/analytics/ads
- /api/campaigns/[id]/status

📚 Documentação:
- Release Notes completo
- Guias de implementação e testes
- Schemas de banco de dados

Breaking Changes: Nenhuma
Versão: 2.0.0"
```

### 4. Verificar Commit

```bash
git log -1
```

### 5. Push para Repositório

```bash
# Push para branch atual
git push

# OU criar nova branch para esta feature
git checkout -b feature/analytics-multi-nivel-v2
git push -u origin feature/analytics-multi-nivel-v2
```

---

## 🏷️ Criar Tag de Versão

```bash
# Criar tag anotada
git tag -a v2.0.0 -m "Release v2.0.0 - Analytics Multi-Nível

Principais features:
- Analytics em 3 níveis hierárquicos
- Filtros avançados (seleção múltipla + data customizada)
- Toggle de campanhas
- Formatação de datas padronizada
- Base para alertas de saldo"

# Push da tag
git push origin v2.0.0

# Listar tags
git tag -l
```

---

## 📋 Checklist Pré-Commit

- [x] Código testado localmente
- [x] Sem erros no console
- [x] Formatação aplicada (Kiro IDE)
- [x] Documentação criada
- [x] Release notes escritas
- [x] Arquivos desnecessários removidos
- [x] .env não commitado
- [x] node_modules ignorado

---

## 🔍 Verificar Arquivos Modificados

```bash
# Ver diferenças
git diff

# Ver arquivos staged
git diff --cached

# Ver estatísticas
git diff --stat
```

---

## 🌿 Estratégia de Branch

### Opção 1: Commit Direto na Main

```bash
git add .
git commit -m "feat: Analytics Multi-Nível v2.0.0 [mensagem completa]"
git push origin main
```

### Opção 2: Feature Branch (Recomendado)

```bash
# Criar branch
git checkout -b feature/analytics-v2

# Commit
git add .
git commit -m "feat: Analytics Multi-Nível v2.0.0 [mensagem completa]"

# Push
git push -u origin feature/analytics-v2

# Depois: Criar Pull Request no GitHub/GitLab
```

### Opção 3: Release Branch

```bash
# Criar branch de release
git checkout -b release/v2.0.0

# Commit
git add .
git commit -m "feat: Analytics Multi-Nível v2.0.0 [mensagem completa]"

# Push
git push -u origin release/v2.0.0

# Merge para main após aprovação
```

---

## 📊 Estatísticas do Commit

```bash
# Ver estatísticas
git diff --stat HEAD

# Contar linhas adicionadas/removidas
git diff --shortstat HEAD
```

**Estimativa:**
- Arquivos novos: ~15
- Arquivos modificados: ~8
- Linhas adicionadas: ~3.500
- Linhas removidas: ~200

---

## 🔄 Reverter se Necessário

```bash
# Desfazer último commit (mantém mudanças)
git reset --soft HEAD~1

# Desfazer último commit (descarta mudanças)
git reset --hard HEAD~1

# Reverter commit específico
git revert <commit-hash>
```

---

## 📝 Mensagem de Commit Alternativa (Curta)

```bash
git commit -m "feat: Analytics Multi-Nível v2.0.0

- Analytics em 3 níveis (Campanhas/Conjuntos/Anúncios)
- Seleção múltipla de campanhas
- Range de data personalizado
- Toggle para ativar/pausar campanhas
- Formatação de datas padronizada
- Base para alertas de saldo

Closes #[issue-number]"
```

---

## 🎯 Conventional Commits

Esta implementação segue o padrão Conventional Commits:

```
feat: Nova funcionalidade
fix: Correção de bug
docs: Documentação
style: Formatação
refactor: Refatoração
test: Testes
chore: Manutenção
```

---

## ✅ Após o Commit

1. **Verificar CI/CD**
   - Aguardar build passar
   - Verificar testes automatizados

2. **Deploy**
   - Staging primeiro
   - Testes em staging
   - Deploy para produção

3. **Comunicação**
   - Notificar equipe
   - Atualizar changelog
   - Documentar no Notion/Confluence

4. **Monitoramento**
   - Verificar logs
   - Monitorar erros (Sentry)
   - Acompanhar métricas

---

## 🚀 Deploy Rápido

```bash
# Se usar Vercel
vercel --prod

# Se usar Netlify
netlify deploy --prod

# Se usar Docker
docker build -t gestor-engrene:v2.0.0 .
docker push gestor-engrene:v2.0.0
```

---

## 📞 Suporte Pós-Deploy

Se encontrar problemas após deploy:

1. Verificar logs: `vercel logs` ou console do servidor
2. Rollback se necessário: `git revert` + redeploy
3. Hotfix em branch separada
4. Comunicar equipe e usuários

---

**Pronto para commit!** 🎉

Execute os comandos acima na ordem para fazer o commit completo da v2.0.0.
