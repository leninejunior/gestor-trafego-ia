# Como Buscar IDs dos Planos

Os botões da landing page precisam dos IDs reais dos planos do banco de dados.

## 🔍 Método 1: Via Supabase Dashboard

1. Acesse o Supabase Dashboard: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **Table Editor** → **subscription_plans**
4. Copie os IDs (UUID) de cada plano:
   - Basic
   - Pro
   - Enterprise

## 🔍 Método 2: Via SQL Editor

Execute no SQL Editor do Supabase:

```sql
SELECT id, name, monthly_price, annual_price 
FROM subscription_plans 
WHERE is_active = true
ORDER BY monthly_price;
```

Resultado esperado:
```
id                                   | name       | monthly_price | annual_price
-------------------------------------|------------|---------------|-------------
abc123-uuid-basic                    | Basic      | 29.00         | 290.00
def456-uuid-pro                      | Pro        | 79.00         | 790.00
ghi789-uuid-enterprise               | Enterprise | 199.00        | 1990.00
```

## 🔍 Método 3: Via API

Crie um arquivo temporário `test-plans.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getPlans() {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, monthly_price, annual_price')
    .eq('is_active', true)
    .order('monthly_price');

  if (error) {
    console.error('Erro:', error);
    return;
  }

  console.log('\n📋 Planos disponíveis:\n');
  data.forEach(plan => {
    console.log(`${plan.name}:`);
    console.log(`  ID: ${plan.id}`);
    console.log(`  Mensal: R$ ${plan.monthly_price}`);
    console.log(`  Anual: R$ ${plan.annual_price}\n`);
  });
}

getPlans();
```

Execute:
```bash
node test-plans.js
```

## ✏️ Atualizar Landing Page

Depois de obter os IDs, atualize os links em `src/components/landing/landing-page.tsx`:

```tsx
{/* Basic Plan */}
<Button className="w-full" size="lg" asChild>
  <Link href="/checkout?plan=SEU_ID_BASIC_AQUI">Começar Agora</Link>
</Button>

{/* Pro Plan */}
<Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg" asChild>
  <Link href="/checkout?plan=SEU_ID_PRO_AQUI">Começar Agora</Link>
</Button>

{/* Enterprise Plan */}
<Button className="w-full" size="lg" asChild>
  <Link href="/checkout?plan=SEU_ID_ENTERPRISE_AQUI">Começar Agora</Link>
</Button>
```

## 🎯 Alternativa: Usar Nome do Plano

Se preferir usar o nome ao invés do ID, modifique a página de checkout para buscar por nome:

Em `src/app/checkout/page.tsx`, altere:

```typescript
const planName = searchParams.get('plan') // 'basic', 'pro', 'enterprise'

const loadPlan = async (name: string) => {
  const response = await fetch('/api/subscriptions/plans')
  const data = await response.json()
  
  const selectedPlan = data.plans?.find((p: Plan) => 
    p.name.toLowerCase() === name.toLowerCase()
  )
  // ...
}
```

E use nos links:
```tsx
<Link href="/checkout?plan=basic">Começar Agora</Link>
<Link href="/checkout?plan=pro">Começar Agora</Link>
<Link href="/checkout?plan=enterprise">Começar Agora</Link>
```

## ⚠️ Importante

- Os planos são criados automaticamente quando você aplica o schema `subscription-plans-schema.sql`
- Se os planos não existirem, execute:
  ```bash
  # No Supabase SQL Editor, execute:
  database/subscription-plans-schema.sql
  ```
- Os IDs são UUIDs gerados automaticamente pelo PostgreSQL
- Cada ambiente (dev/prod) terá IDs diferentes

## 🔄 Sincronizar IDs entre Ambientes

Se você tem ambientes diferentes (dev/staging/prod), considere:

1. **Usar identificadores fixos:** Adicione uma coluna `slug` na tabela
2. **Sincronizar via script:** Crie script para copiar IDs
3. **Usar variáveis de ambiente:** Armazene IDs em `.env`

Exemplo com variáveis de ambiente:

```env
# .env
NEXT_PUBLIC_PLAN_BASIC_ID=abc-123-uuid
NEXT_PUBLIC_PLAN_PRO_ID=def-456-uuid
NEXT_PUBLIC_PLAN_ENTERPRISE_ID=ghi-789-uuid
```

```tsx
// landing-page.tsx
<Link href={`/checkout?plan=${process.env.NEXT_PUBLIC_PLAN_PRO_ID}`}>
  Começar Agora
</Link>
```
