# 📋 PASSO A PASSO - Configurar Google Cloud Console

## 🎯 Objetivo
Adicionar o URI de redirecionamento `http://localhost:3000/api/google/callback` no Google Cloud Console para corrigir o erro de OAuth.

## 🚀 PASSOS DETALHADOS

### 1. Acessar Google Cloud Console
1. Abra o navegador
2. Vá para: https://console.cloud.google.com
3. Faça login com sua conta Google
4. Selecione o projeto correto (se tiver múltiplos)

### 2. Navegar para Credentials
1. No menu lateral esquerdo, clique em **"APIs & Services"**
2. Clique em **"Credentials"**
3. Você verá uma lista de credenciais

### 3. Encontrar seu OAuth Client
1. Procure por um item do tipo **"OAuth 2.0 Client IDs"**
2. O nome pode ser algo como "Web client" ou similar
3. O Client ID deve começar com: `839778729862-rctp31o4ai6hcsmuj9lpqcg05fuolv43`
4. **Clique no ícone de edição (lápis)** ao lado do Client ID

### 4. Adicionar URIs de Redirecionamento
1. Na tela de edição, procure a seção **"Authorized redirect URIs"**
2. Clique em **"+ ADD URI"**
3. Digite exatamente: `http://localhost:3000/api/google/callback`
4. Clique em **"+ ADD URI"** novamente (opcional)
5. Digite: `https://localhost:3000/api/google/callback`

### 5. Salvar Alterações
1. Role para baixo
2. Clique no botão **"SAVE"** (azul)
3. Aguarde a confirmação de que foi salvo

### 6. Aguardar Propagação
- As mudanças podem levar **2-5 minutos** para propagar
- Seja paciente!

## ✅ VERIFICAÇÃO

Após configurar, teste:

1. **Volte para sua aplicação**
2. **Recarregue a página** (F5)
3. **Clique em "Conectar Google Ads"**
4. **Deve redirecionar para Google sem erro**

## 🔧 Se Ainda Não Funcionar

### Opção 1: Limpar Cache
1. Pressione `Ctrl + Shift + Delete`
2. Limpe cache e cookies
3. Tente novamente

### Opção 2: Aba Anônita
1. Abra uma aba anônima/privada
2. Acesse sua aplicação
3. Teste o OAuth

### Opção 3: Verificar Client ID
1. Confirme que o Client ID no Google Cloud é o mesmo do `.env`
2. Deve ser: `839778729862-rctp31o4ai6hcsmuj9lpqcg05fuolv43.apps.googleusercontent.com`

## 📱 URIs Completas para Configurar

**Para desenvolvimento:**
```
http://localhost:3000/api/google/callback
https://localhost:3000/api/google/callback
```

**Para produção (quando necessário):**
```
https://seudominio.com/api/google/callback
https://www.seudominio.com/api/google/callback
```

## 🎯 Resultado Esperado

Após configurar corretamente:
- ✅ Clique em "Conectar Google Ads" funciona
- ✅ Redireciona para Google OAuth
- ✅ Após autorizar, retorna para sua aplicação
- ✅ Conexão é estabelecida com sucesso

---

**⏰ Tempo total: 5-10 minutos**

**🔑 Chave do sucesso: URI exato e aguardar propagação**