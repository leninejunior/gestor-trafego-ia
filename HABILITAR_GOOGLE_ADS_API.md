# 🔧 Como Habilitar a Google Ads API

## ❌ Problema Atual

Você está recebendo o erro:
```
501 Not Implemented
"Operation is not implemented, or supported, or enabled."
```

Isso significa que a **Google Ads API não está habilitada** no seu projeto do Google Cloud Console.

## ✅ Solução: Habilitar a API

### Passo 1: Acessar o Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Faça login com sua conta Google (`drive.engrene@gmail.com`)

### Passo 2: Selecionar o Projeto Correto

1. No topo da página, clique no **seletor de projetos**
2. Selecione o projeto que contém suas credenciais OAuth:
   - Client ID: `839778729862-rctp31o4ai6hcsmuj9lpqcg05fuolv43.apps.googleusercontent.com`
   - Provavelmente o projeto se chama algo como "flying-fox-bob" ou similar

### Passo 3: Habilitar a Google Ads API

**Opção A - Link Direto:**
1. Acesse: https://console.cloud.google.com/apis/library/googleads.googleapis.com
2. Certifique-se de que o projeto correto está selecionado
3. Clique no botão **"ENABLE" (Ativar)**
4. Aguarde alguns segundos até a API ser ativada

**Opção B - Busca Manual:**
1. No menu lateral, vá em **"APIs & Services" > "Library"**
2. Na barra de busca, digite: **"Google Ads API"**
3. Clique em **"Google Ads API"**
4. Clique no botão **"ENABLE" (Ativar)**

### Passo 4: Verificar se a API foi Habilitada

1. Vá em **"APIs & Services" > "Enabled APIs & services"**
2. Procure por **"Google Ads API"** na lista
3. Deve aparecer como **"Enabled"**

## 🧪 Testar Após Habilitar

Depois de habilitar a API, execute:

```bash
node scripts/testar-developer-token-direto.js
```

Se tudo estiver correto, você deve ver:
- ✅ Status 200 (ou outro código que não seja 501)
- ✅ Lista de contas acessíveis

## 🔄 Refazer o OAuth

Após habilitar a API, você precisa refazer o OAuth:

1. **Limpar conexões antigas:**
   ```bash
   node scripts/limpar-conexoes-google.js
   ```

2. **Acessar o dashboard:**
   - Abra: http://localhost:3000/dashboard/clients
   - Clique em "Conectar Google Ads"
   - Complete o OAuth com `drive.engrene@gmail.com`

3. **Verificar contas reais:**
   - Desta vez, as **contas reais** do Google Ads devem aparecer!
   - Não mais as contas mockadas

## 📋 Checklist

- [ ] Acessei o Google Cloud Console
- [ ] Selecionei o projeto correto
- [ ] Habilitei a Google Ads API
- [ ] Verifiquei que a API está "Enabled"
- [ ] Testei com o script de teste
- [ ] Limpei as conexões antigas
- [ ] Refiz o OAuth
- [ ] Vi as contas reais do Google Ads

## ❓ Problemas Comuns

### "Não encontro a Google Ads API"
- Certifique-se de estar no projeto correto
- Use o link direto: https://console.cloud.google.com/apis/library/googleads.googleapis.com

### "Erro de permissão ao habilitar"
- Você precisa ser **Owner** ou **Editor** do projeto
- Se não tiver permissão, peça ao administrador do projeto

### "API habilitada mas ainda dá erro 501"
- Aguarde 1-2 minutos para a API propagar
- Limpe o cache do navegador
- Refaça o OAuth completamente

## 📚 Documentação Oficial

- Google Ads API: https://developers.google.com/google-ads/api/docs/start
- Google Cloud Console: https://console.cloud.google.com/

---

**Próximo Passo:** Habilite a API e me avise quando terminar! 🚀
