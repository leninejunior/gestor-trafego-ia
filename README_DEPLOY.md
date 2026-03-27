# ðŸš€ Deploy em ProduÃ§Ã£o - InÃ­cio RÃ¡pido

## ðŸ“š DocumentaÃ§Ã£o DisponÃ­vel

Escolha o guia adequado ao seu tempo e experiÃªncia:

### 1. **DEPLOY_RAPIDO.md** âš¡ (5 minutos)
Para quem jÃ¡ conhece plataforma de deploy e quer deploy rÃ¡pido.
```bash
# Verificar e fazer deploy
node scripts\pre-deploy-check.js
deploy --prod
```

### 2. **DEPLOY_PRODUCAO.md** ðŸ“– (20 minutos)
Guia completo passo a passo com troubleshooting.
- PreparaÃ§Ã£o do banco de dados
- ConfiguraÃ§Ã£o detalhada
- Testes de produÃ§Ã£o
- Monitoramento

### 3. **DEPLOY_SUMMARY.md** ðŸ“Š (Leitura)
Resumo executivo do que foi preparado.
- Status do sistema
- Checklist de prontidÃ£o
- MÃ©tricas de sucesso

### 4. **COMANDOS_DEPLOY.md** ðŸ› ï¸ (ReferÃªncia)
Lista de comandos Ãºteis para deploy e manutenÃ§Ã£o.
- Comandos plataforma de deploy
- Comandos Git
- Troubleshooting

### 5. **DEPLOY_VPS.md** (VPS Manual)
Guia para publicar manualmente em `edith.engrene.com` via SSH.
- Script pronto: `scripts/deploy-vps.ps1`
- Reinicio por `pm2`, `systemd` ou `docker`

---

## âš¡ Deploy em 3 Comandos

Se vocÃª jÃ¡ tem tudo configurado:

```bash
# 1. Verificar
node scripts\pre-deploy-check.js

# 2. Deploy
deploy --prod

# 3. Verificar logs
deploy logs --follow
```

---

## ðŸŽ¯ Primeira Vez? Siga Esta Ordem

### Passo 1: PreparaÃ§Ã£o (5 min)
1. Crie conta na [plataforma de deploy](https://provedor-deploy.com)
2. Tenha seu projeto [Supabase](https://supabase.com) pronto
3. Configure [Meta Developer App](https://developers.facebook.com)

### Passo 2: VerificaÃ§Ã£o (1 min)
```bash
node scripts\pre-deploy-check.js
```

### Passo 3: Banco de Dados (2 min)
Acesse Supabase SQL Editor e execute:
1. `database/complete-schema.sql`
2. `database/google-ads-schema.sql`

### Passo 4: Deploy (2 min)
```bash
deploy login
deploy --prod
```

### Passo 5: ConfiguraÃ§Ã£o (5 min)
1. Configure variÃ¡veis de ambiente na plataforma de deploy
2. Configure callbacks no Meta/Google Console
3. Teste a aplicaÃ§Ã£o

**Guia detalhado:** `DEPLOY_RAPIDO.md`

---

## ðŸ“‹ Checklist MÃ­nimo

Antes de fazer deploy, certifique-se:

- [ ] Projeto Supabase criado e configurado
- [ ] Meta Developer App criado
- [ ] Schemas aplicados no Supabase
- [ ] VariÃ¡veis de ambiente preparadas
- [ ] Pre-deploy check passou

---

## ðŸ”‘ VariÃ¡veis de Ambiente ObrigatÃ³rias

Configure na plataforma de deploy Dashboard > Settings > Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
META_APP_ID=xxx
META_APP_SECRET=xxx
NEXT_PUBLIC_APP_URL=https://seu-app.seu-dominio.com
CRON_SECRET=xxx
```

**Template completo:** `.env.production.example`

---

## ðŸ†˜ Problemas Comuns

### "Failed to fetch"
â†’ Verificar callbacks no Meta/Google Console

### "Database error"
â†’ Verificar credenciais Supabase

### "RLS policy violation"
â†’ Executar `database/fix-rls-policies.sql`

### Build falha
â†’ Verificar logs: `deploy logs --build`

**Troubleshooting completo:** `DEPLOY_PRODUCAO.md` seÃ§Ã£o "Troubleshooting"

---

## ðŸ“ž Onde Buscar Ajuda

1. **DocumentaÃ§Ã£o de Deploy:**
   - `DEPLOY_RAPIDO.md` - Guia rÃ¡pido
   - `DEPLOY_PRODUCAO.md` - Guia completo
   - `COMANDOS_DEPLOY.md` - ReferÃªncia de comandos

2. **DocumentaÃ§Ã£o de IntegraÃ§Ãµes:**
   - `docs/META_INTEGRATION.md` - Meta Ads
   - `GOOGLE_ADS_CONNECTION_FIX_DOCUMENTATION.md` - Google Ads

3. **Logs:**
   - plataforma de deploy: `deploy logs --follow`
   - Supabase: Dashboard > Logs

---

## âœ… Sistema EstÃ¡ Pronto!

Todos os componentes foram testados e documentados. O sistema estÃ¡ 100% pronto para deploy em produÃ§Ã£o.

**PrÃ³xima aÃ§Ã£o:** Escolha um guia acima e comece o deploy!

---

**VersÃ£o:** 0.1.1  
**Ãšltima atualizaÃ§Ã£o:** 2025-11-27  
**Preparado por:** Kiro AI

