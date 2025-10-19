# ✅ Configuração Completa para Produção

## 🎯 Status: Deploy realizado com sucesso!

Agora precisamos configurar as variáveis de ambiente e o banco de dados para tudo funcionar.

---

## 1️⃣ VARIÁVEIS DE AMBIENTE NO VERCEL

Acesse: https://vercel.com/seu-projeto/settings/environment-variables

### Variáveis Obrigatórias:

```bash
# Supabase (CRÍTICO)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-key

# Meta Ads (CRÍTICO para integração)
META_APP_ID=seu-app-id
META_APP_SECRET=seu-app-secret
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app

# Meta API (opcional mas recomendado)
META_API_VERSION=v21.0
```

### Como adicionar no Vercel:

1. Vá em **Settings** → **Environment Variables**
2. Adicione cada variável acima
3. Selecione os ambientes: **Production**, **Preview**, **Development**
4. Clique em **Save**

---

## 2️⃣ BANCO DE DADOS SUPABASE

### A. Verificar se o schema está aplicado

Acesse o Supabase SQL Editor e execute:

```sql
-- Verificar tabelas principais
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

### B. Aplicar schemas necessários (se não existirem)

Execute na ordem:

1. **Schema principal**: `database/complete-schema.sql`
2. **Meta Ads**: `database/meta-ads-schema.sql`
3. **SaaS**: `database/saas-schema.sql`
4. **RLS Policies**: `database/fix-rls-policies.sql`

### C. Criar primeiro usuário admin

```sql
-- Após criar conta no Supabase Auth, execute:
INSERT INTO memberships (user_id, org_id, role)
VALUES (
  'seu-user-id-do-supabase-auth',
  (SELECT id FROM organizations LIMIT 1),
  'super_admin'
);
```

---

## 3️⃣ META ADS - CONFIGURAÇÃO DO APP

### A. Configurar URLs de Callback

No Meta for Developers (https://developers.facebook.com):

1. Vá em **Seu App** → **Configurações** → **Básico**
2. Adicione o domínio: `seu-dominio.vercel.app`
3. Em **Produtos** → **Login do Facebook** → **Configurações**:
   - **URIs de redirecionamento OAuth válidos**:
     ```
     https://seu-dominio.vercel.app/api/meta/callback
     ```

### B. Permissões necessárias

Certifique-se que seu app tem:
- ✅ `ads_management`
- ✅ `ads_read`
- ✅ `business_management`
- ✅ `pages_read_engagement`

---

## 4️⃣ TESTAR FUNCIONALIDADES

### Ordem de testes:

1. **Login/Autenticação**
   - Acesse: `https://seu-dominio.vercel.app`
   - Crie uma conta
   - Faça login

2. **Criar Cliente**
   - Vá em Dashboard → Clientes
   - Clique em "Novo Cliente"
   - Preencha os dados

3. **Conectar Meta Ads**
   - Entre no cliente criado
   - Clique em "Conectar Meta Ads"
   - Autorize o acesso
   - Selecione as contas

4. **Ver Campanhas**
   - Após conectar, as campanhas devem aparecer
   - Verifique se os dados estão sendo sincronizados

---

## 5️⃣ PROBLEMAS COMUNS E SOLUÇÕES

### ❌ "Não autorizado" ao acessar clientes

**Causa**: Usuário não tem organização

**Solução**:
```sql
-- No Supabase SQL Editor
INSERT INTO organizations (name, created_at)
VALUES ('Minha Agência', NOW())
RETURNING id;

-- Use o ID retornado acima
INSERT INTO memberships (user_id, org_id, role)
VALUES ('seu-user-id', 'org-id-acima', 'admin');
```

### ❌ Erro ao conectar Meta Ads

**Causa**: URLs de callback não configuradas

**Solução**: Verifique item 3.A acima

### ❌ Campanhas não aparecem

**Causa**: Tabelas do banco não existem

**Solução**: Execute `database/meta-ads-schema.sql`

### ❌ Erro 500 em qualquer API

**Causa**: Variáveis de ambiente faltando

**Solução**: Verifique item 1 acima

---

## 6️⃣ MONITORAMENTO

### Logs do Vercel

Acesse: https://vercel.com/seu-projeto/logs

Filtre por:
- **Errors**: Para ver erros em produção
- **API Routes**: Para debug de APIs específicas

### Logs do Supabase

Acesse: Supabase Dashboard → Logs → API Logs

---

## 7️⃣ OTIMIZAÇÕES RECOMENDADAS

### A. Habilitar Caching (opcional)

No `next.config.ts`, já está configurado:
```typescript
experimental: {
  optimizeCss: true,
}
```

### B. Configurar domínio customizado

1. No Vercel: **Settings** → **Domains**
2. Adicione seu domínio
3. Configure DNS conforme instruções
4. Atualize `NEXT_PUBLIC_APP_URL` no Vercel
5. Atualize callback URL no Meta for Developers

---

## 8️⃣ SEGURANÇA

### ✅ Checklist de Segurança:

- [ ] Variáveis de ambiente configuradas no Vercel (não no código)
- [ ] RLS policies aplicadas no Supabase
- [ ] Meta App em modo produção (não desenvolvimento)
- [ ] HTTPS habilitado (automático no Vercel)
- [ ] Domínio verificado no Meta for Developers

---

## 9️⃣ BACKUP E RECUPERAÇÃO

### Backup automático do Supabase

O Supabase faz backup automático, mas você pode:

1. Exportar dados: **Database** → **Backups**
2. Baixar SQL dump manualmente

### Backup do código

Já está no GitHub, mas considere:
- Tags de versão para releases importantes
- Branch `production` separada (opcional)

---

## 🎯 PRÓXIMOS PASSOS APÓS CONFIGURAÇÃO

1. **Testar fluxo completo** (login → criar cliente → conectar Meta → ver campanhas)
2. **Convidar usuários** (se aplicável)
3. **Configurar notificações** (email, webhooks)
4. **Monitorar performance** (Vercel Analytics)
5. **Documentar processos** para sua equipe

---

## 📞 SUPORTE

Se encontrar problemas:

1. Verifique logs do Vercel
2. Verifique logs do Supabase
3. Consulte este documento
4. Verifique `CORRECAO_BUILD_PRODUCAO.md` para problemas de build

---

## ✅ CHECKLIST FINAL

- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Banco de dados Supabase com schemas aplicados
- [ ] Meta App configurado com URLs corretas
- [ ] Primeiro usuário admin criado
- [ ] Login funcionando
- [ ] Criação de clientes funcionando
- [ ] Conexão Meta Ads funcionando
- [ ] Campanhas sendo exibidas
- [ ] Domínio customizado configurado (opcional)
- [ ] Monitoramento ativo

---

**Última atualização**: Deploy bem-sucedido em produção
**Status**: ✅ Build passando | ⚙️ Configuração pendente
