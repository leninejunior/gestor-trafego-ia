# Corrigir RLS dos Planos - EXECUTAR AGORA ⚡

## Problema Identificado

O update dos planos não está funcionando porque a política RLS (Row Level Security) está verificando apenas a tabela `memberships`, mas você está usando a tabela `admin_users`.

**Log do erro:**
```
📊 Update result: { dataLength: 0, data: [] }
⚠️ No data returned from update, but plan exists. Returning current state.
```

## Solução Rápida - 2 Opções

### Opção 1: Via Supabase Dashboard (RECOMENDADO) ✅

1. **Acesse o Supabase Dashboard**
   - Vá para: https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor**
   - Menu lateral → SQL Editor
   - Clique em "New Query"

3. **Cole e Execute o SQL**
   - Copie TODO o conteúdo do arquivo: `database/fix-subscription-plans-rls.sql`
   - Cole no editor
   - Clique em "Run" ou pressione Ctrl+Enter

4. **Verifique o Resultado**
   - Deve mostrar as políticas criadas
   - Procure por mensagens de sucesso

### Opção 2: Via Script Node.js

```bash
node scripts/fix-subscription-plans-rls.js
```

**Nota:** Esta opção pode não funcionar se você não tiver a função `exec_sql` no Supabase. Use a Opção 1 se houver problemas.

## O Que o SQL Faz

1. **Remove políticas antigas** que só verificavam `memberships`
2. **Cria novas políticas** que verificam AMBAS as tabelas:
   - `admin_users` (sua tabela atual)
   - `memberships` (tabela do sistema SaaS)

### Políticas Criadas

```sql
-- Leitura pública de planos ativos
CREATE POLICY "subscription_plans_public_read" 
ON subscription_plans FOR SELECT 
USING (is_active = true);

-- Admin pode fazer tudo (INSERT, UPDATE, DELETE)
CREATE POLICY "subscription_plans_admin_all" 
ON subscription_plans FOR ALL 
USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR
    EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND role = 'super_admin')
);
```

## Após Aplicar

1. **Recarregue a página** do admin de planos
2. **Tente editar um plano** novamente
3. **Verifique:**
   - ✅ Mensagem de sucesso verde aparece
   - ✅ Plano é atualizado na lista
   - ✅ Valores são salvos corretamente

## Verificar se Funcionou

Execute no SQL Editor do Supabase:

```sql
-- Ver políticas atuais
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'subscription_plans';
```

Deve retornar:
- `subscription_plans_public_read` (SELECT)
- `subscription_plans_admin_all` (ALL)

## Troubleshooting

### Se ainda não funcionar:

1. **Verifique se você é admin:**
```sql
SELECT * FROM admin_users WHERE user_id = auth.uid();
```

2. **Teste a política manualmente:**
```sql
-- Tente fazer um update simples
UPDATE subscription_plans 
SET description = 'Teste' 
WHERE id = 'SEU_PLAN_ID';
```

3. **Verifique RLS está habilitado:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'subscription_plans';
```

## Status

⏳ **AGUARDANDO EXECUÇÃO** - Execute a Opção 1 agora!
