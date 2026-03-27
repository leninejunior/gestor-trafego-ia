# ðŸš€ Guia de Deploy em ProduÃ§Ã£o - Ads Manager

## âœ… PrÃ©-requisitos

### 1. Contas e Credenciais NecessÃ¡rias

- [ ] Conta plataforma de deploy (recomendado) ou outra plataforma Next.js
- [ ] Projeto Supabase em produÃ§Ã£o
- [ ] Meta Developer App configurado para produÃ§Ã£o
- [ ] Google Cloud Console configurado (se usar Google Ads)

### 2. VariÃ¡veis de Ambiente ObrigatÃ³rias

Copie de `.env.production.example` e configure:

```env
# Supabase (OBRIGATÃ“RIO)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role

# Meta Ads (OBRIGATÃ“RIO)
META_APP_ID=seu_meta_app_id
META_APP_SECRET=seu_meta_app_secret

# App URL (OBRIGATÃ“RIO - atualizar apÃ³s primeiro deploy)
NEXT_PUBLIC_APP_URL=https://seu-dominio.seu-dominio.com

# Google Ads (OPCIONAL - se usar integraÃ§Ã£o Google)
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret
GOOGLE_DEVELOPER_TOKEN=seu_google_developer_token
GOOGLE_TOKEN_ENCRYPTION_KEY=chave_aleatoria_32_caracteres
```

---

## ðŸ“‹ Checklist de Deploy

### Fase 1: PreparaÃ§Ã£o do Banco de Dados

#### 1.1 Aplicar Schema Base no Supabase

Acesse: https://supabase.com/dashboard/project/SEU_PROJETO/sql

Execute na ordem:

1. **Schema completo:**
   ```sql
   -- Copie e execute: database/complete-schema.sql
   ```

2. **Schema Google Ads (se usar):**
   ```sql
   -- Copie e execute: database/google-ads-schema.sql
   ```

3. **Verificar RLS Policies:**
   ```sql
   -- Copie e execute: database/check-rls-policies.sql
   ```

#### 1.2 Verificar Tabelas Criadas

Execute no SQL Editor:

```sql
-- Verificar tabelas principais
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'organizations',
    'memberships',
    'clients',
    'client_meta_connections',
    'meta_campaigns',
    'google_ads_connections',
    'google_ads_campaigns'
  )
ORDER BY table_name;
```

Deve retornar todas as tabelas listadas.

---

### Fase 2: ConfiguraÃ§Ã£o da Plataforma de Deploy

#### 2.1 Deploy na plataforma de deploy (Recomendado)

**Passo 1: Instalar plataforma de deploy CLI**
```bash
npm install -g deploy
```

**Passo 2: Login**
```bash
deploy login
```

**Passo 3: Configurar VariÃ¡veis de Ambiente**

Via Dashboard:
1. Acesse: https://provedor-deploy.com/dashboard
2. Selecione seu projeto
3. Settings > Environment Variables
4. Adicione TODAS as variÃ¡veis de `.env.production.example`

Via CLI:
```bash
# Adicionar uma variÃ¡vel
deploy env add NEXT_PUBLIC_SUPABASE_URL production

# Ou importar de arquivo
deploy env pull .env.production
```

**Passo 4: Deploy**
```bash
# Deploy de produÃ§Ã£o
deploy --prod

# Ou usar script npm
npm run deploy
```

#### 2.2 Deploy em Outras Plataformas

**Netlify:**
```bash
npm run build
# Upload da pasta .next via Netlify Dashboard
```

**AWS Amplify / Railway / Render:**
- Configure build command: `npm run build`
- Configure start command: `npm start`
- Adicione variÃ¡veis de ambiente no dashboard

---

### Fase 3: ConfiguraÃ§Ã£o PÃ³s-Deploy

#### 3.1 Atualizar URL da AplicaÃ§Ã£o

ApÃ³s primeiro deploy, vocÃª terÃ¡ uma URL (ex: `https://seu-app.seu-dominio.com`)

**Atualizar variÃ¡vel de ambiente:**
```bash
deploy env add NEXT_PUBLIC_APP_URL production
# Valor: https://seu-app.seu-dominio.com
```

**Ou via Dashboard:**
Settings > Environment Variables > Edit `NEXT_PUBLIC_APP_URL`

**Redeploy para aplicar:**
```bash
deploy --prod
```

#### 3.2 Configurar Meta Developer Console

1. Acesse: https://developers.facebook.com/apps/
2. Selecione seu app
3. Settings > Basic
4. **App Domains:** Adicione `seu-app.seu-dominio.com`
5. **Privacy Policy URL:** `https://seu-app.seu-dominio.com/privacy`
6. **Terms of Service URL:** `https://seu-app.seu-dominio.com/terms`

7. **Facebook Login > Settings:**
   - Valid OAuth Redirect URIs:
     ```
     https://seu-app.seu-dominio.com/meta/callback
     https://seu-app.seu-dominio.com/api/meta/callback
     ```

8. **Marketing API > Settings:**
   - Verificar permissÃµes: `ads_management`, `ads_read`, `business_management`

#### 3.3 Configurar Google Cloud Console (se usar Google Ads)

1. Acesse: https://console.cloud.google.com/
2. APIs & Services > Credentials
3. Edite seu OAuth 2.0 Client ID
4. **Authorized redirect URIs:**
   ```
   https://seu-app.seu-dominio.com/google/callback
   https://seu-app.seu-dominio.com/api/google/callback
   ```

#### 3.4 Configurar Cron de Saldo (a cada 10 minutos)

1. Defina a variavel `CRON_SECRET` na plataforma de deploy.
2. Configure um scheduler para chamar:
   - `GET https://seu-app.seu-dominio.com/api/cron/balance-sync`
   - Header: `Authorization: Bearer <CRON_SECRET>`
   - Frequencia: `*/10 * * * *`

Teste manual:

```bash
curl -X GET "https://seu-app.seu-dominio.com/api/cron/balance-sync" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

---

### Fase 4: Testes de ProduÃ§Ã£o

#### 4.1 Smoke Tests BÃ¡sicos

**Teste 1: AplicaÃ§Ã£o carrega**
```bash
curl https://seu-app.seu-dominio.com
# Deve retornar HTML sem erro 500
```

**Teste 2: API Health Check**
```bash
curl https://seu-app.seu-dominio.com/api/health
# Deve retornar: {"status":"ok"}
```

**Teste 3: ConexÃ£o Supabase**
- Acesse: `https://seu-app.seu-dominio.com`
- Tente fazer login/signup
- Verifique se usuÃ¡rio Ã© criado no Supabase

#### 4.2 Testes de IntegraÃ§Ã£o

**Meta Ads:**
1. Login na aplicaÃ§Ã£o
2. Criar um cliente
3. Dashboard > Meta Ads > Conectar Conta
4. Autorizar no Facebook
5. Verificar se campanhas aparecem

**Google Ads:**
1. Dashboard > Google Ads > Conectar Conta
2. Autorizar no Google
3. Sincronizar campanhas
4. Verificar se aparecem na lista

#### 4.3 Verificar Logs

**plataforma de deploy:**
```bash
deploy logs --follow
```

**Ou via Dashboard:**
https://provedor-deploy.com/dashboard > Seu Projeto > Logs

**Supabase:**
https://supabase.com/dashboard/project/SEU_PROJETO/logs

---

### Fase 5: Monitoramento

#### 5.1 Configurar Alertas

**plataforma de deploy:**
- Settings > Notifications
- Ativar alertas de deploy failed
- Ativar alertas de erros em runtime

**Supabase:**
- Settings > Alerts
- Configurar alertas de uso de recursos
- Configurar alertas de erros de API

#### 5.2 MÃ©tricas para Monitorar

- **Uptime:** AplicaÃ§Ã£o acessÃ­vel 24/7
- **Response Time:** < 2s para pÃ¡ginas
- **Error Rate:** < 1% de requisiÃ§Ãµes
- **Database Connections:** NÃ£o exceder limite
- **API Rate Limits:** Meta e Google Ads

---

## ðŸ”§ Troubleshooting

### Erro: "Failed to fetch" ao conectar Meta/Google

**Causa:** URL de callback incorreta

**SoluÃ§Ã£o:**
1. Verificar `NEXT_PUBLIC_APP_URL` estÃ¡ correto
2. Verificar callbacks no Meta/Google Console
3. Redeploy apÃ³s corrigir

### Erro: "Database connection failed"

**Causa:** Credenciais Supabase incorretas

**SoluÃ§Ã£o:**
1. Verificar `NEXT_PUBLIC_SUPABASE_URL`
2. Verificar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Verificar `SUPABASE_SERVICE_ROLE_KEY`
4. Testar conexÃ£o no Supabase Dashboard

### Erro: "RLS policy violation"

**Causa:** PolÃ­ticas RLS nÃ£o aplicadas

**SoluÃ§Ã£o:**
1. Executar `database/fix-rls-policies.sql`
2. Verificar com `database/check-rls-policies.sql`
3. Verificar membership do usuÃ¡rio

### Build falha com erros TypeScript

**Causa:** Erros de tipo nÃ£o resolvidos

**SoluÃ§Ã£o:**
O projeto estÃ¡ configurado com `ignoreBuildErrors: true` no `next.config.ts`, entÃ£o isso nÃ£o deve bloquear o deploy. Se quiser corrigir:

```bash
npm run lint
# Corrigir erros reportados
```

---

## ðŸ“Š Checklist Final

Antes de considerar o deploy completo:

- [ ] AplicaÃ§Ã£o acessÃ­vel via HTTPS
- [ ] Login/Signup funcionando
- [ ] CriaÃ§Ã£o de clientes funcionando
- [ ] ConexÃ£o Meta Ads funcionando
- [ ] Campanhas Meta sendo listadas
- [ ] ConexÃ£o Google Ads funcionando (se aplicÃ¡vel)
- [ ] Campanhas Google sendo listadas (se aplicÃ¡vel)
- [ ] Logs sem erros crÃ­ticos
- [ ] VariÃ¡veis de ambiente todas configuradas
- [ ] Callbacks configurados no Meta/Google
- [ ] RLS policies ativas no Supabase
- [ ] Cron jobs configurados (se aplicÃ¡vel)
- [ ] Monitoramento ativo

---

## ðŸŽ¯ PrÃ³ximos Passos PÃ³s-Deploy

1. **DocumentaÃ§Ã£o:**
   - Criar guia de usuÃ¡rio
   - Documentar fluxos principais
   - Criar FAQ

2. **OtimizaÃ§Ã£o:**
   - Configurar CDN para assets
   - Otimizar imagens
   - Implementar cache

3. **SeguranÃ§a:**
   - Configurar rate limiting
   - Implementar CAPTCHA no signup
   - Revisar polÃ­ticas RLS

4. **Escalabilidade:**
   - Monitorar uso de recursos
   - Planejar upgrade de planos
   - Implementar queue para jobs pesados

---

## ðŸ“ž Suporte

Se encontrar problemas:

1. Verificar logs da plataforma de deploy
2. Verificar logs do Supabase
3. Consultar documentaÃ§Ã£o especÃ­fica:
   - `docs/META_INTEGRATION.md`
   - `GOOGLE_ADS_CONNECTION_FIX_DOCUMENTATION.md`
   - `docs/TROUBLESHOOTING.md`

---

**Ãšltima atualizaÃ§Ã£o:** 2025-11-27
**VersÃ£o do sistema:** 0.1.1

