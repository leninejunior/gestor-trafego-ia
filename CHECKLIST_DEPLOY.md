# ✅ Checklist de Deploy para Produção

## 📋 Antes de Começar

- [ ] Tenho conta no GitHub
- [ ] Tenho conta na Vercel
- [ ] Tenho acesso ao Supabase
- [ ] Tenho acesso ao Meta Developer Console
- [ ] Tenho as credenciais do Meta App

## 🔍 Verificações de Segurança

- [ ] `.env` está no `.gitignore`
- [ ] Não há credenciais hardcoded no código
- [ ] `.env.example` está atualizado
- [ ] Políticas RLS estão aplicadas no Supabase
- [ ] Tokens sensíveis não estão commitados

## 📦 Preparação do Código

- [ ] Executei `npm run pre-deploy` com sucesso
- [ ] Todos os testes passam (se houver)
- [ ] Build local funciona: `npm run build`
- [ ] Não há erros de TypeScript
- [ ] Removi console.logs desnecessários

## 🗄️ Banco de Dados

- [ ] Schema completo aplicado: `database/complete-schema.sql`
- [ ] Schema SaaS aplicado: `database/saas-schema.sql`
- [ ] Políticas RLS aplicadas: `database/fix-rls-policies.sql`
- [ ] Funções admin aplicadas: `database/admin-functions.sql`
- [ ] Features avançadas aplicadas: `database/advanced-features-schema.sql`
- [ ] Verifiquei RLS: `database/check-rls-policies.sql`

## 🔧 Git & GitHub

- [ ] Repositório criado no GitHub
- [ ] Código commitado: `git add . && git commit -m "feat: deploy"`
- [ ] Push feito: `git push origin main`
- [ ] Branch principal é `main` ou `master`

## 🚀 Vercel

### Configuração Inicial
- [ ] Projeto criado na Vercel
- [ ] Repositório conectado
- [ ] Framework detectado como Next.js
- [ ] Build command: `npm run build`
- [ ] Output directory: `.next`

### Variáveis de Ambiente
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada
- [ ] `META_APP_ID` configurada
- [ ] `META_APP_SECRET` configurada
- [ ] `NEXT_PUBLIC_APP_URL` configurada (com URL da Vercel)

### Deploy
- [ ] Primeiro deploy executado
- [ ] Build completou com sucesso
- [ ] Site está acessível
- [ ] Não há erros no console do navegador

## 🔗 Meta Developer Console

- [ ] App ID correto: `1582506459384854`
- [ ] Domínio da Vercel adicionado em "Domínios do App"
- [ ] URLs de callback configuradas:
  - [ ] `https://seu-dominio.vercel.app/api/meta/callback`
  - [ ] `https://seu-dominio.vercel.app/meta/select-accounts`
- [ ] Permissões corretas: `ads_read`, `ads_management`, `business_management`
- [ ] App está em modo "Live" (não Development)

## 🧪 Testes em Produção

- [ ] Login funciona
- [ ] Criar usuário funciona
- [ ] Criar cliente funciona
- [ ] Conectar Meta Ads funciona
- [ ] Campanhas são sincronizadas
- [ ] Dashboard carrega corretamente
- [ ] Métricas aparecem
- [ ] Não há erros no console

## 📊 Monitoramento

- [ ] Vercel Analytics habilitado (opcional)
- [ ] Logs da Vercel funcionando: `vercel logs`
- [ ] Alertas configurados (opcional)
- [ ] Backup do banco configurado

## 📝 Documentação

- [ ] README.md atualizado com URL de produção
- [ ] Equipe informada sobre deploy
- [ ] Credenciais salvas em local seguro
- [ ] Documentação de API atualizada (se houver)

## 🎯 Pós-Deploy

- [ ] Monitorar logs por 24h
- [ ] Verificar performance
- [ ] Testar com usuários reais
- [ ] Coletar feedback
- [ ] Planejar próximas features

## 🆘 Em Caso de Problemas

### Rollback Rápido
```bash
# Na Vercel Dashboard
Deployments > [deployment anterior] > ... > Promote to Production
```

### Verificar Logs
```bash
vercel logs --follow
```

### Suporte
- Vercel: https://vercel.com/support
- Supabase: https://supabase.com/support
- Meta: https://developers.facebook.com/support

---

## 📈 Status do Deploy

**Data**: ___/___/______
**Responsável**: _________________
**URL Produção**: _________________
**Status**: [ ] Em Progresso [ ] Concluído [ ] Com Problemas

**Notas**:
_________________________________________________
_________________________________________________
_________________________________________________

---

**Última atualização**: 19/10/2025
