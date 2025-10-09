# 🗄️ Configuração do Banco de Dados

## ⚡ **Configuração Rápida**

### 1. Acesse o Supabase
1. Vá para [supabase.com](https://supabase.com)
2. Faça login na sua conta
3. Selecione seu projeto ou crie um novo

### 2. Execute o Script SQL
1. No painel do Supabase, vá para **SQL Editor**
2. Clique em **New Query**
3. Copie todo o conteúdo do arquivo `database/complete-schema.sql`
4. Cole no editor SQL
5. Clique em **Run** para executar

### 3. Verificar Criação das Tabelas
Após executar, você deve ver estas tabelas criadas:
- ✅ `organizations`
- ✅ `memberships` 
- ✅ `clients`
- ✅ `client_meta_connections`
- ✅ `ad_accounts`
- ✅ `oauth_tokens`
- ✅ `meta_campaigns`
- ✅ `meta_campaign_insights`

### 4. Testar o Sistema
1. Reinicie o servidor: `scripts\simple-restart.bat`
2. Acesse: http://localhost:3000
3. Faça login
4. Tente adicionar um cliente

## 🔧 **Se Houver Erros**

### Erro: "relation does not exist"
- Execute o script SQL completo novamente
- Verifique se todas as tabelas foram criadas

### Erro: "permission denied"
- Verifique se as políticas RLS foram criadas
- Confirme que o usuário está autenticado

### Erro: "function does not exist"
- Execute a função `create_org_and_add_admin()` novamente

## 📋 **Verificação Manual**

Execute estas queries no SQL Editor para verificar:

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verificar se a função existe
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'create_org_and_add_admin';

-- Testar criação de organização (após login)
SELECT create_org_and_add_admin();
```

## 🚀 **Após Configuração**

O sistema estará pronto para:
- ✅ Adicionar clientes
- ✅ Conectar Meta Ads
- ✅ Conectar Google Ads
- ✅ Gerenciar campanhas
- ✅ Visualizar relatórios

## 📞 **Suporte**

Se ainda houver problemas:
1. Verifique os logs do navegador (F12)
2. Confirme as variáveis de ambiente no `.env`
3. Teste a conexão com Supabase