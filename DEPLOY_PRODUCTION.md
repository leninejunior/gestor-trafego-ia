# Guia de Deploy para Produção

## 📋 Checklist Pré-Deploy

### 1. Verificações de Segurança
- [ ] Remover todos os console.logs sensíveis
- [ ] Verificar que não há credenciais hardcoded
- [ ] Confirmar que `.env` está no `.gitignore`
- [ ] Revisar políticas RLS no Supabase
- [ ] Validar permissões de API

### 2. Configuração de Ambiente

#### Variáveis de Ambiente Necessárias na Vercel
```bash
# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role

# Meta Ads (obrigatório)
META_APP_ID=seu_app_id
META_APP_SECRET=seu_app_secret
META_ACCESS_TOKEN=seu_token (opcional, pode ser configurado depois)

# URL da Aplicação (obrigatório)
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app

# Opcional - Google Ads (futuro)
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret

# Opcional - Stripe (se usar pagamentos)
STRIPE_PUBLISHABLE_KEY=sua_chave_publica
STRIPE_SECRET_KEY=sua_chave_secreta
STRIPE_WEBHOOK_SECRET=seu_webhook_secret

# Opcional - Email (Resend)
RESEND_API_KEY=sua_chave_resend
```

### 3. Configuração do Meta App para Produção

#### Atualizar URLs de Callback no Meta Developer Console
1. Acesse: https://developers.facebook.com/apps/
2. Selecione seu app (ID: 1582506459384854)
3. Vá em **Configurações > Básico**
4. Adicione domínios permitidos:
   - `seu-dominio.vercel.app`
   - `seu-dominio-personalizado.com` (se tiver)

5. Em **Produtos > Login do Facebook > Configurações**:
   - **URIs de redirecionamento OAuth válidos**:
     ```
     https://seu-dominio.vercel.app/api/meta/callback
     https://seu-dominio.vercel.app/meta/select-accounts
     ```

6. Em **Marketing API**:
   - Verificar permissões: `ads_read`, `ads_management`, `business_management`

### 4. Preparação do Banco de Dados

#### Executar no Supabase SQL Editor (se ainda não executou):
```sql
-- 1. Schema completo
-- Execute: database/complete-schema.sql

-- 2. Schema SaaS
-- Execute: database/saas-schema.sql

-- 3. Políticas RLS
-- Execute: database/fix-rls-policies.sql

-- 4. Funções Admin
-- Execute: database/admin-functions.sql

-- 5. Features Avançadas
-- Execute: database/advanced-features-schema.sql
```

#### Verificar RLS:
```sql
-- Execute: database/check-rls-policies.sql
```

## 🚀 Deploy na Vercel

### Opção 1: Via GitHub (Recomendado)

#### Passo 1: Preparar Repositório Git
```bash
# Verificar status
git status

# Adicionar arquivos
git add .

# Commit
git commit -m "feat: preparação para deploy em produção"

# Push para GitHub
git push origin main
```

#### Passo 2: Conectar na Vercel
1. Acesse: https://vercel.com
2. Clique em **Add New Project**
3. Importe seu repositório do GitHub
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build` (padrão)
   - **Output Directory**: `.next` (padrão)

#### Passo 3: Adicionar Variáveis de Ambiente
1. Na página do projeto, vá em **Settings > Environment Variables**
2. Adicione TODAS as variáveis listadas acima
3. Selecione os ambientes: **Production**, **Preview**, **Development**

#### Passo 4: Deploy
1. Clique em **Deploy**
2. Aguarde o build completar (3-5 minutos)
3. Acesse a URL gerada

### Opção 2: Via Vercel CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Seguir prompts para configurar variáveis de ambiente
```

## 🔧 Configurações Pós-Deploy

### 1. Atualizar NEXT_PUBLIC_APP_URL
Após o primeiro deploy, você terá uma URL da Vercel. Atualize:
1. Na Vercel: Settings > Environment Variables
2. Altere `NEXT_PUBLIC_APP_URL` para a URL real
3. Redeploy: Deployments > ... > Redeploy

### 2. Configurar Domínio Personalizado (Opcional)
1. Na Vercel: Settings > Domains
2. Adicione seu domínio: `gestor.engrene.com`
3. Configure DNS conforme instruções
4. Aguarde propagação (até 48h)
5. Atualize `NEXT_PUBLIC_APP_URL` novamente

### 3. Testar Integração Meta
1. Acesse: `https://seu-dominio.vercel.app/dashboard`
2. Crie um cliente de teste
3. Conecte conta Meta Ads
4. Verifique se campanhas são sincronizadas

### 4. Configurar Webhooks (Opcional)
Para receber atualizações em tempo real do Meta:
1. No Meta Developer Console
2. Produtos > Webhooks
3. Adicione: `https://seu-dominio.vercel.app/api/webhooks/meta`
4. Subscreva eventos: `ads_insights`, `campaign_status`

## 🔍 Monitoramento

### Logs da Vercel
```bash
# Ver logs em tempo real
vercel logs --follow

# Ver logs de produção
vercel logs --prod
```

### Métricas no Dashboard
- Acesse: https://vercel.com/seu-usuario/seu-projeto
- Veja: Analytics, Speed Insights, Logs

## 🐛 Troubleshooting

### Erro: "Module not found"
```bash
# Limpar cache e reinstalar
rm -rf node_modules .next
npm install
vercel --prod
```

### Erro: "Supabase connection failed"
- Verificar variáveis de ambiente na Vercel
- Confirmar que URLs estão corretas
- Testar conexão no Supabase Dashboard

### Erro: "Meta OAuth redirect mismatch"
- Verificar URLs de callback no Meta Developer Console
- Confirmar `NEXT_PUBLIC_APP_URL` está correto
- Aguardar 5-10 minutos para propagação

### Erro: "Database RLS policy violation"
- Executar: `database/check-rls-policies.sql`
- Aplicar: `database/fix-rls-policies.sql`
- Verificar permissões de usuário

## 📊 Performance

### Otimizações Aplicadas
- ✅ Next.js 15 com App Router
- ✅ React Server Components
- ✅ Lazy loading de componentes
- ✅ Image optimization automática
- ✅ Code splitting por rota

### Recomendações Adicionais
- Configurar CDN para assets estáticos
- Habilitar Vercel Analytics
- Configurar monitoring com Sentry (opcional)
- Implementar rate limiting nas APIs

## 🔐 Segurança

### Checklist de Segurança
- ✅ RLS habilitado em todas as tabelas
- ✅ Variáveis sensíveis em environment variables
- ✅ HTTPS forçado (automático na Vercel)
- ✅ CORS configurado corretamente
- ✅ Validação de input com Zod
- ✅ Sanitização de dados

### Headers de Segurança (Opcional)
Adicione em `next.config.ts`:
```typescript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'origin-when-cross-origin',
        },
      ],
    },
  ];
},
```

## 📝 Manutenção

### Atualizações Regulares
```bash
# Atualizar dependências
npm update

# Verificar vulnerabilidades
npm audit

# Corrigir vulnerabilidades
npm audit fix
```

### Backup do Banco de Dados
- Supabase faz backup automático
- Acesse: Supabase Dashboard > Database > Backups
- Configure backups adicionais se necessário

## 🎯 Próximos Passos

1. [ ] Configurar monitoring avançado
2. [ ] Implementar testes E2E
3. [ ] Configurar CI/CD pipeline
4. [ ] Adicionar feature flags
5. [ ] Implementar A/B testing
6. [ ] Configurar alertas de erro

## 📞 Suporte

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Meta API Docs**: https://developers.facebook.com/docs/marketing-apis

---

**Última atualização**: 19/10/2025
**Versão do Sistema**: 2.0.0
