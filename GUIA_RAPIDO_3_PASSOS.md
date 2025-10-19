# ⚡ Guia Rápido - 3 Passos para Funcionar

## 🎯 Domínio: gestor.engrene.com

---

## PASSO 1: VERCEL (2 minutos)

### 1.1 Adicionar Variável de Ambiente

1. Acesse: https://vercel.com
2. Clique no seu projeto
3. Vá em **Settings** → **Environment Variables**
4. Clique em **Add New**
5. Preencha:
   - **Name**: `NEXT_PUBLIC_APP_URL`
   - **Value**: `https://gestor.engrene.com`
   - **Environments**: Marque todos (Production, Preview, Development)
6. Clique em **Save**

### 1.2 Fazer Redeploy

1. Vá em **Deployments**
2. Clique nos 3 pontinhos do último deploy
3. Clique em **Redeploy**
4. Aguarde o build terminar (1-2 minutos)

✅ **Pronto! Passo 1 concluído**

---

## PASSO 2: META FOR DEVELOPERS - Callback URL (2 minutos)

### 2.1 Acessar Configurações

1. Acesse: https://developers.facebook.com/apps
2. Clique no seu app (o mesmo do META_APP_ID)
3. No menu lateral esquerdo, clique em **Produtos**
4. Clique em **Login do Facebook**
5. Clique em **Configurações**

### 2.2 Adicionar URI de Redirecionamento

1. Procure por **"URIs de redirecionamento OAuth válidos"**
2. No campo de texto, adicione:
   ```
   https://gestor.engrene.com/api/meta/callback
   ```
3. Clique em **Salvar alterações** (botão azul no final da página)

✅ **Pronto! Passo 2 concluído**

---

## PASSO 3: META FOR DEVELOPERS - Domínio (1 minuto)

### 3.1 Adicionar Domínio do App

1. Ainda no Meta for Developers
2. No menu lateral esquerdo, clique em **Configurações**
3. Clique em **Básico**
4. Role a página até encontrar **"Domínios do app"**
5. Clique em **"+ Adicionar domínio"**
6. Digite:
   ```
   gestor.engrene.com
   ```
7. Clique em **Salvar alterações** (botão azul no final da página)

✅ **Pronto! Passo 3 concluído**

---

## 🎉 CONFIGURAÇÃO COMPLETA!

Agora teste:

1. Acesse: **https://gestor.engrene.com**
2. Crie uma conta
3. Faça login
4. Crie um cliente
5. Conecte Meta Ads

---

## 🆘 SE DER ERRO

### "Usuário não possui organização"

Execute no Supabase SQL Editor:

```sql
-- Criar organização
INSERT INTO organizations (name, created_at)
VALUES ('Engrene', NOW())
RETURNING id;

-- Vincular usuário (pegue seu user_id em Authentication > Users)
INSERT INTO memberships (user_id, org_id, role)
VALUES ('SEU_USER_ID', 'ORG_ID_ACIMA', 'super_admin');
```

### "Redirect URI não corresponde"

Verifique se adicionou EXATAMENTE:
- `https://gestor.engrene.com/api/meta/callback`
- Com `https://`
- Com `/api/meta/callback` no final

### Erro 500

1. Verifique se fez o Redeploy no Vercel (Passo 1.2)
2. Aguarde 1-2 minutos para o deploy terminar
3. Limpe o cache do navegador (Ctrl+Shift+R)

---

## 📋 CHECKLIST VISUAL

```
[ ] Passo 1.1 - Variável NEXT_PUBLIC_APP_URL adicionada no Vercel
[ ] Passo 1.2 - Redeploy feito e concluído
[ ] Passo 2 - Callback URL adicionada no Meta
[ ] Passo 3 - Domínio adicionado no Meta
[ ] Teste - Site abre em gestor.engrene.com
[ ] Teste - Consegue fazer login
[ ] Teste - Consegue criar cliente
[ ] Teste - Consegue conectar Meta Ads
```

---

## ⏱️ TEMPO TOTAL: ~5 minutos

**Dificuldade**: ⭐ Fácil (só copiar e colar)

---

## 🎯 URLS PARA COPIAR E COLAR

**Para o Vercel:**
```
https://gestor.engrene.com
```

**Para o Meta (Callback):**
```
https://gestor.engrene.com/api/meta/callback
```

**Para o Meta (Domínio):**
```
gestor.engrene.com
```

---

**Pronto! Depois desses 3 passos, tudo vai funcionar! 🚀**
