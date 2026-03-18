# 🚀 Guia de Deploy em Produção - Ads Manager

## ✅ Pré-requisitos

### 1. Contas e Credenciais Necessárias

- [ ] Conta Vercel (recomendado) ou outra plataforma Next.js
- [ ] Projeto Supabase em produção
- [ ] Meta Developer App configurado para produção
- [ ] Google Cloud Console configurado (se usar Google Ads)

### 2. Variáveis de Ambiente Obrigatórias

Copie de `.env.production.example` e configure:

```env
# Supabase (OBRIGATÓRIO)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role

# Meta Ads (OBRIGATÓRIO)
META_APP_ID=seu_meta_app_id
META_APP_SECRET=seu_meta_app_secret

# App URL (OBRIGATÓRIO - atualizar após primeiro deploy)
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app

# Google Ads (OPCIONAL - se usar integração Google)
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret
GOOGLE_DEVELOPER_TOKEN=seu_google_developer_token
GOOGLE_TOKEN_ENCRYPTION_KEY=chave_aleatoria_32_caracteres
```

---

## 📋 Checklist de Deploy

### Fase 1: Preparação do Banco de Dados

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

### Fase 2: Configuração da Plataforma de Deploy

#### 2.1 Deploy na Vercel (Recomendado)

**Passo 1: Instalar Vercel CLI**
```bash
npm install -g vercel
```

**Passo 2: Login**
```bash
vercel login
```

**Passo 3: Configurar Variáveis de Ambiente**

Via Dashboard:
1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Settings > Environment Variables
4. Adicione TODAS as variáveis de `.env.production.example`

Via CLI:
```bash
# Adicionar uma variável
vercel env add NEXT_PUBLIC_SUPABASE_URL production

# Ou importar de arquivo
vercel env pull .env.production
```

**Passo 4: Deploy**
```bash
# Deploy de produção
vercel --prod

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
- Adicione variáveis de ambiente no dashboard

---

### Fase 3: Configuração Pós-Deploy

#### 3.1 Atualizar URL da Aplicação

Após primeiro deploy, você terá uma URL (ex: `https://seu-app.vercel.app`)

**Atualizar variável de ambiente:**
```bash
vercel env add NEXT_PUBLIC_APP_URL production
# Valor: https://seu-app.vercel.app
```

**Ou via Dashboard:**
Settings > Environment Variables > Edit `NEXT_PUBLIC_APP_URL`

**Redeploy para aplicar:**
```bash
vercel --prod
```

#### 3.2 Configurar Meta Developer Console

1. Acesse: https://developers.facebook.com/apps/
2. Selecione seu app
3. Settings > Basic
4. **App Domains:** Adicione `seu-app.vercel.app`
5. **Privacy Policy URL:** `https://seu-app.vercel.app/privacy`
6. **Terms of Service URL:** `https://seu-app.vercel.app/terms`

7. **Facebook Login > Settings:**
   - Valid OAuth Redirect URIs:
     ```
     https://seu-app.vercel.app/meta/callback
     https://seu-app.vercel.app/api/meta/callback
     ```

8. **Marketing API > Settings:**
   - Verificar permissões: `ads_management`, `ads_read`, `business_management`

#### 3.3 Configurar Google Cloud Console (se usar Google Ads)

1. Acesse: https://console.cloud.google.com/
2. APIs & Services > Credentials
3. Edite seu OAuth 2.0 Client ID
4. **Authorized redirect URIs:**
   ```
   https://seu-app.vercel.app/google/callback
   https://seu-app.vercel.app/api/google/callback
   ```

---

### Fase 4: Testes de Produção

#### 4.1 Smoke Tests Básicos

**Teste 1: Aplicação carrega**
```bash
curl https://seu-app.vercel.app
# Deve retornar HTML sem erro 500
```

**Teste 2: API Health Check**
```bash
curl https://seu-app.vercel.app/api/health
# Deve retornar: {"status":"ok"}
```

**Teste 3: Conexão Supabase**
- Acesse: `https://seu-app.vercel.app`
- Tente fazer login/signup
- Verifique se usuário é criado no Supabase

#### 4.2 Testes de Integração

**Meta Ads:**
1. Login na aplicação
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

**Vercel:**
```bash
vercel logs --follow
```

**Ou via Dashboard:**
https://vercel.com/dashboard > Seu Projeto > Logs

**Supabase:**
https://supabase.com/dashboard/project/SEU_PROJETO/logs

---

### Fase 5: Monitoramento

#### 5.1 Configurar Alertas

**Vercel:**
- Settings > Notifications
- Ativar alertas de deploy failed
- Ativar alertas de erros em runtime

**Supabase:**
- Settings > Alerts
- Configurar alertas de uso de recursos
- Configurar alertas de erros de API

#### 5.2 Métricas para Monitorar

- **Uptime:** Aplicação acessível 24/7
- **Response Time:** < 2s para páginas
- **Error Rate:** < 1% de requisições
- **Database Connections:** Não exceder limite
- **API Rate Limits:** Meta e Google Ads

---

## 🔧 Troubleshooting

### Erro: "Failed to fetch" ao conectar Meta/Google

**Causa:** URL de callback incorreta

**Solução:**
1. Verificar `NEXT_PUBLIC_APP_URL` está correto
2. Verificar callbacks no Meta/Google Console
3. Redeploy após corrigir

### Erro: "Database connection failed"

**Causa:** Credenciais Supabase incorretas

**Solução:**
1. Verificar `NEXT_PUBLIC_SUPABASE_URL`
2. Verificar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Verificar `SUPABASE_SERVICE_ROLE_KEY`
4. Testar conexão no Supabase Dashboard

### Erro: "RLS policy violation"

**Causa:** Políticas RLS não aplicadas

**Solução:**
1. Executar `database/fix-rls-policies.sql`
2. Verificar com `database/check-rls-policies.sql`
3. Verificar membership do usuário

### Build falha com erros TypeScript

**Causa:** Erros de tipo não resolvidos

**Solução:**
O projeto está configurado com `ignoreBuildErrors: true` no `next.config.ts`, então isso não deve bloquear o deploy. Se quiser corrigir:

```bash
npm run lint
# Corrigir erros reportados
```

---

## 📊 Checklist Final

Antes de considerar o deploy completo:

- [ ] Aplicação acessível via HTTPS
- [ ] Login/Signup funcionando
- [ ] Criação de clientes funcionando
- [ ] Conexão Meta Ads funcionando
- [ ] Campanhas Meta sendo listadas
- [ ] Conexão Google Ads funcionando (se aplicável)
- [ ] Campanhas Google sendo listadas (se aplicável)
- [ ] Logs sem erros críticos
- [ ] Variáveis de ambiente todas configuradas
- [ ] Callbacks configurados no Meta/Google
- [ ] RLS policies ativas no Supabase
- [ ] Cron jobs configurados (se aplicável)
- [ ] Monitoramento ativo

---

## 🎯 Próximos Passos Pós-Deploy

1. **Documentação:**
   - Criar guia de usuário
   - Documentar fluxos principais
   - Criar FAQ

2. **Otimização:**
   - Configurar CDN para assets
   - Otimizar imagens
   - Implementar cache

3. **Segurança:**
   - Configurar rate limiting
   - Implementar CAPTCHA no signup
   - Revisar políticas RLS

4. **Escalabilidade:**
   - Monitorar uso de recursos
   - Planejar upgrade de planos
   - Implementar queue para jobs pesados

---

## 📞 Suporte

Se encontrar problemas:

1. Verificar logs da Vercel
2. Verificar logs do Supabase
3. Consultar documentação específica:
   - `docs/META_INTEGRATION.md`
   - `GOOGLE_ADS_CONNECTION_FIX_DOCUMENTATION.md`
   - `docs/TROUBLESHOOTING.md`

---

**Última atualização:** 2025-11-27
**Versão do sistema:** 0.1.1
