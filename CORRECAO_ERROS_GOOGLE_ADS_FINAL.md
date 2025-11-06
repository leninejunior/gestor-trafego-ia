# Correção dos Erros do Google Ads - FINAL

## 🔍 Problema Identificado

O OAuth do Google Ads estava funcionando, mas falhava ao salvar os tokens porque as tabelas necessárias não existiam no banco de dados:

- ❌ `google_ads_encryption_keys` - não existe
- ❌ `google_ads_audit_log` - não existe  
- ❌ Colunas `token_expires_at`, `encrypted_refresh_token`, `encrypted_access_token` - não existem

## 🔧 Solução

### 1. Execute o SQL no Supabase

Copie e cole o conteúdo do arquivo `EXECUTAR_NO_SUPABASE_GOOGLE_ADS.sql` no SQL Editor do Supabase.

Este SQL irá:
- ✅ Adicionar colunas que faltam na tabela `google_ads_connections`
- ✅ Criar tabela `google_ads_encryption_keys`
- ✅ Criar tabela `google_ads_audit_log`
- ✅ Criar índices necessários
- ✅ Inserir chave de criptografia inicial
- ✅ Configurar RLS e políticas
- ✅ Verificar se tudo foi criado corretamente

### 2. Após executar o SQL

1. **Refaça o OAuth do Google Ads**:
   - Acesse: http://localhost:3000/dashboard/clients
   - Clique em "Conectar Google Ads"
   - Use sua conta Google real (não de teste)
   - Complete o fluxo de autorização

2. **Verifique se funcionou**:
   - Os tokens serão salvos corretamente
   - As contas reais da sua MCC aparecerão
   - Não haverá mais erros de "tabela não encontrada"

## 🎯 Resultado Esperado

Após executar o SQL e refazer o OAuth:

- ✅ Tokens salvos com criptografia
- ✅ Contas reais da MCC exibidas
- ✅ APIs do Google Ads funcionando
- ✅ Métricas carregando corretamente
- ✅ Auditoria de ações registrada

## 📋 Verificação

Execute este script após a correção:

```bash
node scripts/diagnosticar-erros-google.js
```

Deve mostrar:
- ✅ Conexões com tokens reais (não mock)
- ✅ APIs respondendo corretamente
- ✅ Tabelas criadas e acessíveis

## 🚀 Próximos Passos

1. Execute o SQL no Supabase
2. Refaça o OAuth do Google Ads
3. Teste as funcionalidades
4. Suas contas reais da MCC aparecerão!