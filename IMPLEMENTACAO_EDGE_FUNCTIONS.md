# Implementação com Supabase Edge Functions

## 🎯 Quando Usar Edge Functions

Edge Functions do Supabase devem ser usadas para:
- ✅ Cron jobs e tarefas agendadas
- ✅ Webhooks e integrações externas
- ✅ Processamento assíncrono
- ✅ Operações que precisam de service_role
- ✅ Lógica que não deve ser exposta no cliente

## 📁 Estrutura de Edge Functions

```
supabase/
├── functions/
│   ├── check-balance-alerts/
│   │   └── index.ts
│   ├── send-whatsapp-alert/
│   │   └── index.ts
│   ├── sync-meta-campaigns/
│   │   └── index.ts
│   └── process-analytics/
│       └── index.ts
└── config.toml
```

## 🔧 Edge Functions Necessárias

### 1. Check Balance Alerts (Cron Job)

**Arquivo:** `supabase/functions/check-balance-alerts/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Criar cliente Supabase com service_role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Verificando alertas de saldo...')

    // 1. Buscar todos os alertas ativos
    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from('balance_alerts')
      .select(`
        *,
        client:clients(id, name, organization_id),
        connection:client_meta_connections!inner(
          access_token,
          ad_account_id,
          account_name
        )
      `)
      .eq('is_active', true)
      .eq('connection.is_active', true)

    if (alertsError) throw alertsError

    console.log(`📊