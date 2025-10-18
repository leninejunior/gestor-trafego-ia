# Correção: Erro ao Buscar Cliente

## Problema

Erro ao carregar a página do cliente após conectar conta Meta:
```
❌ [CLIENT PAGE] Erro ao buscar cliente: {}
```

## Possíveis Causas

1. **Políticas RLS incorretas** - O usuário não tem permissão para acessar o cliente
2. **Tabela memberships sem org_id** - Estrutura do banco incorreta
3. **Cliente sem org_id** - Dados inconsistentes

## Solução Passo a Passo

### Passo 1: Diagnóstico Completo

Execute o script de diagnóstico no Supabase SQL Editor:

```sql
-- Copie e execute: database/diagnose-system.sql
```

Este script irá mostrar:
- ✅ Seu usuário atual
- ✅ Organizações existentes
- ✅ Suas memberships
- ✅ Clientes existentes
- ✅ Clientes que você pode acessar
- ✅ Conexões Meta
- ✅ Políticas RLS
- ✅ Estrutura das tabelas

### Passo 2: Corrigir Tabela Memberships (se necessário)

Se o diagnóstico mostrar que `memberships` não tem `org_id`:

```sql
-- Execute: database/fix-memberships-table.sql
```

### Passo 3: Corrigir Políticas RLS de Clients

Execute o script de correção de RLS:

```sql
-- Execute: database/fix-clients-rls.sql
```

Este script irá:
- ✅ Remover políticas antigas
- ✅ Criar políticas corretas
- ✅ Habilitar RLS
- ✅ Testar acesso

### Passo 4: Verificar Dados

Após executar os scripts, verifique se você consegue ver os clientes:

```sql
SELECT 
    c.id,
    c.name,
    c.org_id,
    o.name as organization_name
FROM clients c
JOIN organizations o ON c.org_id = o.id
WHERE c.org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = auth.uid()
);
```

Se não retornar nada, você precisa criar a associação:

```sql
-- Associar seu usuário a uma organização
INSERT INTO memberships (user_id, org_id, role)
SELECT 
    auth.uid(),
    (SELECT id FROM organizations LIMIT 1),
    'admin'
WHERE NOT EXISTS (
    SELECT 1 FROM memberships WHERE user_id = auth.uid()
);
```

### Passo 5: Testar no Dashboard

1. Recarregue a página do cliente
2. Verifique o console do navegador para mensagens de debug
3. O erro deve estar mais detalhado agora

## Scripts Criados

- 📄 `database/diagnose-system.sql` - Diagnóstico completo
- 📄 `database/fix-memberships-table.sql` - Corrige tabela memberships
- 📄 `database/fix-clients-rls.sql` - Corrige políticas RLS de clients

## Verificação Rápida

Execute no SQL Editor:

```sql
-- Verificar se você tem acesso aos clientes
SELECT 
    'Você tem acesso a ' || COUNT(*) || ' cliente(s)' as status
FROM clients c
WHERE c.org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = auth.uid()
);
```

## Próximos Passos

Após a correção:
1. ✅ Você deve conseguir ver a página do cliente
2. ✅ As conexões Meta devem aparecer
3. ✅ As campanhas devem ser listadas

## Suporte

Se o erro persistir:
1. Execute o diagnóstico completo
2. Copie os resultados
3. Verifique se há alguma mensagem de erro específica
4. Verifique o console do navegador para mais detalhes
