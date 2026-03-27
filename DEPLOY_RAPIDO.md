# ðŸš€ Deploy RÃ¡pido - Guia de 5 Minutos

## PrÃ©-requisitos
- Conta plataforma de deploy
- Projeto Supabase configurado
- Meta Developer App criado

## Passo 1: Verificar Sistema (30 segundos)

```bash
node scripts\pre-deploy-check.js
```

Se passar, continue. Se falhar, corrija os erros.

## Passo 2: Aplicar Schema no Supabase (2 minutos)

1. Acesse: https://supabase.com/dashboard/project/SEU_PROJETO/sql
2. Copie e execute: `database/complete-schema.sql`
3. Copie e execute: `database/google-ads-schema.sql` (se usar Google Ads)

## Passo 3: Deploy na plataforma de deploy (2 minutos)

### Via CLI:
```bash
# Instalar plataforma de deploy CLI (se nÃ£o tiver)
npm install -g deploy

# Login
deploy login

# Deploy
deploy --prod
```

### Via Dashboard:
1. Acesse: https://provedor-deploy.com/new
2. Importe seu repositÃ³rio
3. Configure variÃ¡veis de ambiente (veja abaixo)
4. Clique em "Deploy"

## Passo 4: Configurar VariÃ¡veis de Ambiente (1 minuto)

No plataforma de deploy Dashboard > Settings > Environment Variables, adicione:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
META_APP_ID=seu_meta_app_id
META_APP_SECRET=seu_meta_app_secret
NEXT_PUBLIC_APP_URL=https://seu-app.seu-dominio.com
```

**Google Ads (opcional):**
```env
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret
GOOGLE_DEVELOPER_TOKEN=seu_google_developer_token
GOOGLE_TOKEN_ENCRYPTION_KEY=chave_aleatoria_32_chars
```

## Passo 5: Configurar Callbacks (30 segundos)

### Meta Developer Console:
https://developers.facebook.com/apps/SEU_APP/fb-login/settings/

**Valid OAuth Redirect URIs:**
```
https://seu-app.seu-dominio.com/meta/callback
https://seu-app.seu-dominio.com/api/meta/callback
```

### Google Cloud Console (se usar):
https://console.cloud.google.com/apis/credentials

**Authorized redirect URIs:**
```
https://seu-app.seu-dominio.com/google/callback
https://seu-app.seu-dominio.com/api/google/callback
```

## âœ… Pronto!

Acesse: `https://seu-app.seu-dominio.com`

### Teste RÃ¡pido:
1. FaÃ§a login
2. Crie um cliente
3. Conecte uma conta Meta/Google
4. Verifique se campanhas aparecem

---

## ðŸ†˜ Problemas?

Consulte: `DEPLOY_PRODUCAO.md` para guia completo

**Erros comuns:**
- "Failed to fetch" â†’ Verificar callbacks
- "Database error" â†’ Verificar credenciais Supabase
- "RLS policy" â†’ Executar `database/fix-rls-policies.sql`

