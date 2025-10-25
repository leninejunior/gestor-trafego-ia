# SOLUÇÃO FINAL - Planos com Preços Zerados

## Problema Real Identificado

Os campos `monthly_price` e `annual_price` **NÃO EXISTEM** na tabela do Supabase!

O script de verificação mostra:
- `Preço Mensal: undefined`
- `Preço Anual: undefined`

Isso significa que a tabela `subscription_plans` no Supabase tem um schema diferente do esperado.

## Ação Necessária

Você precisa executar uma migração SQL no Supabase para adicionar esses campos:

### Opção 1: Via Supabase Dashboard (RECOMENDADO)

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em "SQL Editor"
4. Execute este SQL:

```sql
-- Adicionar colunas de preço se não existirem
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS annual_price DECIMAL(10,2) DEFAULT 0;

-- Atualizar preços dos planos existentes
UPDATE subscription_plans 
SET monthly_price = 29.00, annual_price = 290.00 
WHERE name = 'Basic';

UPDATE subscription_plans 
SET monthly_price = 99.00, annual_price = 990.00 
WHERE name = 'Pro';

UPDATE subscription_plans 
SET monthly_price = 299.00, annual_price = 2990.00 
WHERE name = 'Enterprise';

-- Verificar resultado
SELECT id, name, monthly_price, annual_price FROM subscription_plans;
```

### Opção 2: Via Script Node.js

Execute este comando:

```bash
node scripts/add-price-columns.js
```

## Depois de Executar

1. Recarregue a página `/admin/plans`
2. Os preços devem aparecer corretamente
3. Teste editar um plano

## Por que isso aconteceu?

A tabela foi criada com um schema antigo que não incluía os campos de preço. O sistema esperava `monthly_price` e `annual_price`, mas eles não existiam no banco.
