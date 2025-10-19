# 🚀 Configuração Final - gestor.engrene.com

## 📍 Seu Domínio: **gestor.engrene.com**

---

## 1️⃣ VARIÁVEIS DE AMBIENTE NO VERCEL

Acesse: https://vercel.com/seu-projeto/settings/environment-variables

### ✅ Adicione/Atualize esta variável:

```bash
NEXT_PUBLIC_APP_URL=https://gestor.engrene.com
```

**Importante**: Depois de adicionar, clique em **Redeploy** para aplicar.

---

## 2️⃣ CONFIGURAR META FOR DEVELOPERS

### A. Adicionar URI de Redirecionamento OAuth

1. Acesse: https://developers.facebook.com/apps
2. Selecione seu app
3. Menu lateral: **Produtos** → **Login do Facebook** → **Configurações**
4. Em **URIs de redirecionamento OAuth válidos**, adicione:

```
https://gestor.engrene.com/api/meta/callback
```

5. Clique em **Salvar alterações**

### B. Adicionar Domínio do App

1. Ainda no Meta for Developers
2. Vá em **Configurações** → **Básico**
3. Role até **Domínios do app**
4. Adicione:

```
gestor.engrene.com
```

5. Salve as alterações

---

## 3️⃣ TESTAR O SISTEMA

### Teste 1: Acessar o Site
```
https://gestor.engrene.com
```
✅ Deve carregar a página de login

### Teste 2: Criar Conta e Fazer Login
1. Clique em "Criar conta"
2. Preencha os dados
3. Faça login

### Teste 3: Verificar Organização

Se aparecer "Usuário não possui organização", execute no **Supabase SQL Editor**:

```sql
-- 1. Criar sua organização
INSERT INTO organizations (name, created_at)
VALUES ('Engrene', NOW())
RETURNING id;

-- Copie o ID retornado acima e use no próximo comando

-- 2. Vincular seu usuário à organização
-- Pegue seu user_id em: Supabase Dashboard → Authentication → Users
INSERT INTO memberships (user_id, org_id, role)
VALUES (
  'SEU_USER_ID_AQUI',  -- Substituir pelo seu user_id
  'ORG_ID_DO_PASSO_1', -- Substituir pelo org_id retornado acima
  'super_admin'
);
```

### Teste 4: Criar Cliente
1. Vá em **Dashboard** → **Clientes**
2. Clique em **"Novo Cliente"**
3. Preencha os dados
4. Salve

### Teste 5: Conectar Meta Ads
1. Entre no cliente criado
2. Clique em **"Conectar Meta Ads"**
3. Será redirecionado para o Facebook
4. Autorize o acesso
5. Selecione as contas de anúncios
6. Deve voltar para o dashboard com as contas conectadas

### Teste 6: Ver Campanhas
1. Após conectar, as campanhas devem aparecer automaticamente
2. Verifique se os dados estão sendo exibidos

---

## 4️⃣ CHECKLIST DE CONFIGURAÇÃO

- [ ] `NEXT_PUBLIC_APP_URL=https://gestor.engrene.com` adicionada no Vercel
- [ ] Redeploy feito no Vercel após adicionar variável
- [ ] Callback URL `https://gestor.engrene.com/api/meta/callback` adicionada no Meta
- [ ] Domínio `gestor.engrene.com` adicionado no Meta App
- [ ] Consegue acessar https://gestor.engrene.com
- [ ] Consegue fazer login
- [ ] Usuário tem organização (ou criou via SQL)
- [ ] Consegue criar cliente
- [ ] Consegue conectar Meta Ads
- [ ] Campanhas aparecem após conectar

---

## 🔧 COMANDOS PRONTOS PARA COPIAR

### Para o Vercel (Environment Variables):
```
Nome: NEXT_PUBLIC_APP_URL
Valor: https://gestor.engrene.com
Ambientes: Production, Preview, Development
```

### Para o Meta for Developers (OAuth Redirect URIs):
```
https://gestor.engrene.com/api/meta/callback
```

### Para o Meta for Developers (App Domains):
```
gestor.engrene.com
```

---

## 🚨 PROBLEMAS COMUNS

### ❌ "Redirect URI não corresponde"
**Solução**: Verifique se adicionou exatamente:
- `https://gestor.engrene.com/api/meta/callback` (com https e /api/meta/callback)

### ❌ "Não autorizado" ao acessar clientes
**Solução**: Execute o SQL do Teste 3 para criar organização e vincular usuário

### ❌ Erro 500 em qualquer página
**Solução**: 
1. Verifique se todas as variáveis de ambiente estão no Vercel
2. Faça Redeploy
3. Verifique os logs: https://vercel.com/seu-projeto/logs

### ❌ Meta Ads não conecta
**Solução**: 
1. Verifique se o app está em modo "Live" (não Development)
2. Verifique se tem as permissões: `ads_management`, `ads_read`, `business_management`
3. Verifique se o callback URL está correto

---

## 📊 MONITORAMENTO

### Logs do Vercel
https://vercel.com/seu-projeto/logs

### Logs do Supabase
Supabase Dashboard → Logs → API Logs

### Verificar se está funcionando
```
curl https://gestor.engrene.com/api/health
```

---

## 🎯 RESUMO RÁPIDO

**3 passos para funcionar:**

1. **Vercel**: Adicionar `NEXT_PUBLIC_APP_URL=https://gestor.engrene.com` e Redeploy
2. **Meta**: Adicionar callback `https://gestor.engrene.com/api/meta/callback`
3. **Meta**: Adicionar domínio `gestor.engrene.com`

**Tempo estimado**: 5 minutos

---

## ✅ APÓS CONFIGURAR

Seu sistema estará 100% funcional em:
**https://gestor.engrene.com**

Funcionalidades disponíveis:
- ✅ Login e autenticação
- ✅ Gestão de clientes
- ✅ Conexão com Meta Ads
- ✅ Visualização de campanhas
- ✅ Métricas e analytics
- ✅ Relatórios

---

**Última atualização**: Configuração para gestor.engrene.com
**Status**: ✅ Deploy realizado | ⚙️ Aguardando configuração final
