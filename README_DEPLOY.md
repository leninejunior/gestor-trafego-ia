# 🚀 Deploy em Produção - Início Rápido

## 📚 Documentação Disponível

Escolha o guia adequado ao seu tempo e experiência:

### 1. **DEPLOY_RAPIDO.md** ⚡ (5 minutos)
Para quem já conhece Vercel e quer deploy rápido.
```bash
# Verificar e fazer deploy
node scripts\pre-deploy-check.js
vercel --prod
```

### 2. **DEPLOY_PRODUCAO.md** 📖 (20 minutos)
Guia completo passo a passo com troubleshooting.
- Preparação do banco de dados
- Configuração detalhada
- Testes de produção
- Monitoramento

### 3. **DEPLOY_SUMMARY.md** 📊 (Leitura)
Resumo executivo do que foi preparado.
- Status do sistema
- Checklist de prontidão
- Métricas de sucesso

### 4. **COMANDOS_DEPLOY.md** 🛠️ (Referência)
Lista de comandos úteis para deploy e manutenção.
- Comandos Vercel
- Comandos Git
- Troubleshooting

---

## ⚡ Deploy em 3 Comandos

Se você já tem tudo configurado:

```bash
# 1. Verificar
node scripts\pre-deploy-check.js

# 2. Deploy
vercel --prod

# 3. Verificar logs
vercel logs --follow
```

---

## 🎯 Primeira Vez? Siga Esta Ordem

### Passo 1: Preparação (5 min)
1. Crie conta na [Vercel](https://vercel.com)
2. Tenha seu projeto [Supabase](https://supabase.com) pronto
3. Configure [Meta Developer App](https://developers.facebook.com)

### Passo 2: Verificação (1 min)
```bash
node scripts\pre-deploy-check.js
```

### Passo 3: Banco de Dados (2 min)
Acesse Supabase SQL Editor e execute:
1. `database/complete-schema.sql`
2. `database/google-ads-schema.sql`

### Passo 4: Deploy (2 min)
```bash
vercel login
vercel --prod
```

### Passo 5: Configuração (5 min)
1. Configure variáveis de ambiente na Vercel
2. Configure callbacks no Meta/Google Console
3. Teste a aplicação

**Guia detalhado:** `DEPLOY_RAPIDO.md`

---

## 📋 Checklist Mínimo

Antes de fazer deploy, certifique-se:

- [ ] Projeto Supabase criado e configurado
- [ ] Meta Developer App criado
- [ ] Schemas aplicados no Supabase
- [ ] Variáveis de ambiente preparadas
- [ ] Pre-deploy check passou

---

## 🔑 Variáveis de Ambiente Obrigatórias

Configure na Vercel Dashboard > Settings > Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
META_APP_ID=xxx
META_APP_SECRET=xxx
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
```

**Template completo:** `.env.production.example`

---

## 🆘 Problemas Comuns

### "Failed to fetch"
→ Verificar callbacks no Meta/Google Console

### "Database error"
→ Verificar credenciais Supabase

### "RLS policy violation"
→ Executar `database/fix-rls-policies.sql`

### Build falha
→ Verificar logs: `vercel logs --build`

**Troubleshooting completo:** `DEPLOY_PRODUCAO.md` seção "Troubleshooting"

---

## 📞 Onde Buscar Ajuda

1. **Documentação de Deploy:**
   - `DEPLOY_RAPIDO.md` - Guia rápido
   - `DEPLOY_PRODUCAO.md` - Guia completo
   - `COMANDOS_DEPLOY.md` - Referência de comandos

2. **Documentação de Integrações:**
   - `docs/META_INTEGRATION.md` - Meta Ads
   - `GOOGLE_ADS_CONNECTION_FIX_DOCUMENTATION.md` - Google Ads

3. **Logs:**
   - Vercel: `vercel logs --follow`
   - Supabase: Dashboard > Logs

---

## ✅ Sistema Está Pronto!

Todos os componentes foram testados e documentados. O sistema está 100% pronto para deploy em produção.

**Próxima ação:** Escolha um guia acima e comece o deploy!

---

**Versão:** 0.1.1  
**Última atualização:** 2025-11-27  
**Preparado por:** Kiro AI
