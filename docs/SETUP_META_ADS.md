# 🔵 Configuração Meta Ads (Facebook/Instagram)

## 📋 **Passo a Passo Completo**

### 1. Criar App no Meta for Developers

1. **Acesse:** https://developers.facebook.com/
2. **Faça login** com sua conta Facebook/Meta
3. **Clique em "Meus Apps"** no canto superior direito
4. **Clique em "Criar App"**

### 2. Configurar o App

1. **Selecione o tipo:** "Empresa" ou "Consumidor"
2. **Preencha os dados:**
   - **Nome do App:** "Ads Manager" (ou o nome que preferir)
   - **Email de contato:** seu email
   - **Categoria:** "Negócios e páginas"

3. **Clique em "Criar App"**

### 3. Adicionar Produto Marketing API

1. **No painel do app**, procure por "Marketing API"
2. **Clique em "Configurar"** no card da Marketing API
3. **Aceite os termos** se solicitado

### 4. Configurar Permissões

1. **Vá para "Configurações do App" > "Básico"**
2. **Anote o App ID** (você vai precisar)
3. **Anote o App Secret** (clique em "Mostrar")

### 5. Adicionar Facebook Login (Obrigatório)

1. **No painel do seu app**, vá para a seção **"Produtos"** (Products)
2. **Clique em "+ Adicionar produto"** ou **"Add Product"**
3. **Procure por "Facebook Login"**
4. **Clique em "Configurar"** no card do Facebook Login
5. **Aceite os termos** se solicitado

### 6. Configurar URLs de Callback

1. **Após adicionar Facebook Login**, vá para **"Produtos" > "Facebook Login" > "Configurações"**
2. **Procure por "URIs de redirecionamento OAuth válidos"** ou **"Valid OAuth Redirect URIs"**
3. **Adicione a URL:**
   ```
   http://localhost:3000/api/meta/callback
   ```
4. **Clique em "Salvar alterações"**

**💡 Dica:** Se não encontrar Facebook Login, verifique se foi adicionado corretamente na seção "Produtos".

### 7. Configurar Domínios do App

1. **Vá para "Configurações do App" > "Básico"**
2. **Role para baixo até "Domínios do App"**
3. **Adicione:**
   ```
   localhost
   ```
4. **Em "URL da Política de Privacidade" (se solicitado), adicione:**
   ```
   http://localhost:3000/privacy
   ```
5. **Salve as alterações**

### 8. Obter Access Token

1. **Vá para "Ferramentas" > "Graph API Explorer"**
2. **Selecione seu app** no dropdown
3. **Clique em "Gerar Token de Acesso"**
4. **Selecione as permissões:**
   - `ads_management`
   - `ads_read`
   - `business_management`
   - `pages_read_engagement`
   - `pages_show_list`
5. **Copie o token gerado**

### 8. Configurar Variáveis de Ambiente

Edite o arquivo `.env` e substitua os valores:

```env
# Meta Ads API Configuration
META_APP_ID=SEU_APP_ID_AQUI
META_APP_SECRET=SEU_APP_SECRET_AQUI
META_ACCESS_TOKEN=SEU_ACCESS_TOKEN_AQUI
```

**Exemplo:**
```env
META_APP_ID=1234567890123456
META_APP_SECRET=abcd1234efgh5678ijkl9012mnop3456
META_ACCESS_TOKEN=EAABwzLixnjYBO...
```

## 🔧 **Configuração Avançada**

### Modo de Desenvolvimento vs Produção

**Para desenvolvimento (localhost):**
- Use as configurações acima
- O app pode ficar em modo "Desenvolvimento"

**Para produção:**
- Adicione seu domínio real nas configurações
- Submeta o app para revisão do Meta
- Configure webhooks se necessário

### Permissões Necessárias

| Permissão | Descrição |
|-----------|-----------|
| `ads_management` | Gerenciar campanhas de anúncios |
| `ads_read` | Ler dados de campanhas |
| `business_management` | Acessar Business Manager |
| `pages_read_engagement` | Ler engajamento de páginas |
| `pages_show_list` | Listar páginas |

## 🧪 **Testar Configuração**

Após configurar as variáveis:

1. **Reinicie o servidor:**
   ```bash
   scripts\simple-restart.bat
   ```

2. **Acesse:** http://localhost:3000/dashboard/clients

3. **Adicione um cliente** e tente conectar Meta Ads

4. **Você deve ser redirecionado** para o Facebook para autorizar

## 🚨 **Problemas Comuns**

### "App ID inválido"
- ✅ Verifique se o `META_APP_ID` está correto
- ✅ Confirme que não há espaços extras
- ✅ Reinicie o servidor após alterar `.env`

### "Redirect URI inválido"
- ✅ Adicione `http://localhost:3000/api/meta/callback` nas configurações
- ✅ Verifique se não há `/` extra no final

### "Permissões insuficientes"
- ✅ Adicione todas as permissões listadas acima
- ✅ Gere um novo access token com as permissões

### "App em modo desenvolvimento"
- ✅ Para testes, pode ficar em desenvolvimento
- ✅ Para produção, submeta para revisão

## 📞 **Suporte**

Se ainda houver problemas:

1. **Verifique os logs** do navegador (F12)
2. **Confirme as variáveis** no arquivo `.env`
3. **Teste com Graph API Explorer** do Meta
4. **Verifique se o app está ativo** no Meta for Developers

## 🔗 **Links Úteis**

- [Meta for Developers](https://developers.facebook.com/)
- [Marketing API Docs](https://developers.facebook.com/docs/marketing-api/)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Permissões de Login](https://developers.facebook.com/docs/permissions/reference)