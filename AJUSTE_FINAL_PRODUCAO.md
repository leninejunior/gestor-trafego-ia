# 🎯 Ajuste Final para Produção Funcionar

## ✅ O que já está OK:
- Build passou
- Deploy realizado
- Variáveis de ambiente copiadas do .env local

## ⚠️ O QUE FALTA (CRÍTICO):

### 1. Atualizar URL no Vercel

No Vercel, adicione/atualize esta variável:

```
NEXT_PUBLIC_APP_URL=https://seu-dominio-vercel.vercel.app
```

**Onde encontrar seu domínio:**
- Vá no Vercel Dashboard
- Clique no seu projeto
- Copie a URL que aparece (ex: `gestortrafego-pago.vercel.app`)

---

### 2. Configurar Callback no Meta for Developers

**Passo a passo:**

1. Acesse: https://developers.facebook.com/apps
2. Selecione seu app (o mesmo do `META_APP_ID`)
3. No menu lateral: **Produtos** → **Login do Facebook** → **Configurações**
4. Em **URIs de redirecionamento OAuth válidos**, adicione:
   ```
   https://seu-dominio-vercel.vercel.app/api/meta/callback
   ```
5. Clique em **Salvar alterações**

---

### 3. Adicionar Domínio nas Configurações Básicas

Ainda no Meta for Developers:

1. Vá em **Configurações** → **Básico**
2. Role até **Domínios do app**
3. Adicione: `seu-dominio-vercel.vercel.app`
4. Salve

---

## 🧪 TESTAR SE ESTÁ FUNCIONANDO

### Teste 1: Acessar o site
```
https://seu-dominio-vercel.vercel.app
```
Deve carregar a página de login.

### Teste 2: Criar conta
1. Clique em "Criar conta"
2. Preencha os dados
3. Faça login

### Teste 3: Verificar se tem organização

Se aparecer "Usuário não possui organização", execute no Supabase:

```sql
-- 1. Criar organização
INSERT INTO organizations (name, created_at)
VALUES ('Minha Agência', NOW())
RETURNING id;

-- 2. Vincular seu usuário (pegue o user_id do Supabase Auth)
INSERT INTO memberships (user_id, org_id, role)
VALUES (
  'seu-user-id-aqui',  -- Pegar em Authentication > Users
  'org-id-do-passo-1',
  'super_admin'
);
```

### Teste 4: Criar cliente
1. Vá em Dashboard → Clientes
2. Clique em "Novo Cliente"
3. Preencha e salve

### Teste 5: Conectar Meta Ads
1. Entre no cliente criado
2. Clique em "Conectar Meta Ads"
3. Deve redirecionar para o Facebook
4. Autorize o acesso
5. Selecione as contas
6. Deve voltar para o dashboard com as contas conectadas

---

## 🔍 DIAGNÓSTICO DE PROBLEMAS

### Problema: "Redirect URI não corresponde"

**Causa**: URL de callback não configurada no Meta

**Solução**: Siga o passo 2 acima

---

### Problema: "Não autorizado" ao acessar clientes

**Causa**: Usuário não tem organização

**Solução**: Execute o SQL do Teste 3 acima

---

### Problema: Erro 500 em qualquer página

**Causa**: Variáveis de ambiente faltando

**Solução**: 
1. Vá no Vercel → Settings → Environment Variables
2. Verifique se todas estão lá:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `NEXT_PUBLIC_APP_URL`
3. Se faltou alguma, adicione e faça **Redeploy**

---

### Problema: Meta Ads não conecta

**Causa 1**: Callback URL errada
- Verifique passo 2

**Causa 2**: App em modo desenvolvimento
- No Meta for Developers, mude para modo "Live" (Ativo)

**Causa 3**: Permissões faltando
- Verifique se o app tem: `ads_management`, `ads_read`, `business_management`

---

## 📋 CHECKLIST RÁPIDO

- [ ] `NEXT_PUBLIC_APP_URL` configurada no Vercel com URL de produção
- [ ] Callback URL adicionada no Meta for Developers
- [ ] Domínio adicionado nas configurações do Meta App
- [ ] Consegue fazer login no site
- [ ] Usuário tem organização (ou criou via SQL)
- [ ] Consegue criar cliente
- [ ] Consegue conectar Meta Ads
- [ ] Campanhas aparecem após conectar

---

## 🎯 RESUMO: O que fazer AGORA

1. **Copie a URL do Vercel** (ex: `gestortrafego-pago.vercel.app`)

2. **Atualize no Vercel**:
   - Adicione `NEXT_PUBLIC_APP_URL=https://sua-url.vercel.app`
   - Faça Redeploy

3. **Atualize no Meta for Developers**:
   - Adicione callback: `https://sua-url.vercel.app/api/meta/callback`
   - Adicione domínio: `sua-url.vercel.app`

4. **Teste o fluxo completo**

---

**Tempo estimado**: 5-10 minutos
**Dificuldade**: Fácil (só copiar e colar URLs)
