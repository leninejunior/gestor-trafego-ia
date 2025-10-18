# Correção da Tabela Memberships

## Problema Identificado

O erro **"column memberships.org_id does not exist"** indica que a tabela `memberships` no seu banco de dados Supabase não tem a coluna `org_id`, que é essencial para o funcionamento do sistema.

## Solução Rápida

### Passo 1: Acessar o Supabase SQL Editor

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor** no menu lateral

### Passo 2: Executar o Script de Correção

Copie e cole o conteúdo do arquivo `database/fix-memberships-table.sql` no SQL Editor e execute.

Este script irá:
- ✅ Verificar a estrutura atual da tabela
- ✅ Adicionar a coluna `org_id` se não existir
- ✅ Criar uma organização padrão
- ✅ Associar todos os usuários existentes à organização
- ✅ Configurar as constraints necessárias

### Passo 3: Testar

Após executar o script, tente adicionar um cliente novamente no dashboard.

## Alternativa: Recriar o Schema Completo

Se preferir começar do zero com o schema correto:

1. **ATENÇÃO**: Isso irá apagar todos os dados existentes!
2. Execute o arquivo: `database/complete-saas-setup.sql`

## Verificação

Para verificar se a correção funcionou, execute no SQL Editor:

```sql
-- Verificar estrutura da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'memberships';

-- Verificar dados
SELECT 
    u.email,
    o.name as organization,
    m.role
FROM memberships m
JOIN auth.users u ON m.user_id = u.id
JOIN organizations o ON m.org_id = o.id;
```

## Próximos Passos

Após a correção, o sistema deve funcionar normalmente e você poderá:
- ✅ Adicionar clientes
- ✅ Gerenciar organizações
- ✅ Convidar membros da equipe

## Suporte

Se o erro persistir, verifique:
1. Se você executou o script completo
2. Se há erros no console do Supabase
3. Se as políticas RLS estão ativas
