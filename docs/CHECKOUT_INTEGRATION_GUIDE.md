# Guia de Integração - Sistema de Checkout e Pagamentos

## Visão Geral

Este guia fornece instruções detalhadas para integrar com o sistema de checkout e pagamentos, incluindo APIs, webhooks, e configurações necessárias.

## Configuração Inicial

### 1. Variáveis de Ambiente

```bash
# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Iugu (obrigatório)
IUGU_API_TOKEN=test_xxx  # ou live_xxx para produção
IUGU_WEBHOOK_SECRET=seu_webhook_secret
IUGU_ACCOUNT_ID=sua_conta_id

# Redis (opcional - para cache)
REDIS_URL=redis://localhost:6379

# URLs (obrigatório)
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
WEBHOOK_BASE_URL=https://seu-dominio.com

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha
```

### 2. Configuração do Banco de Dados

Execute os scripts de migração na ordem:

```bash
# 1. Schema principal
psql -d sua_database -f database/checkout-payment-schema-migration.sql

# 2. Webhook logs e analytics
psql -d sua_database -f database/webhook-logs-analytics-schema.sql

# 3. Subscription intents
psql -d sua_database -f database/subscription-intents-schema.sql

# 4. Transições de estado
psql -d sua_database -f database/subscription-intent-transitions-schema.sql
```

## Integração com APIs

### 1. Autenticação

Todas as APIs requerem autenticação via Supabase JWT:

```typescript
// Cliente
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Fazer login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@exemplo.com',
  password: 'senha123'
})

// Usar token nas requisições
const token = data.session?.access_token
```

### 2. Criar Checkout

```typescript
// POST /api/subscriptions/checkout-iugu
const response = await fetch('/api/subscriptions/checkout-iugu', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    plan_id: 'uuid-do-plano',
    billing_cycle: 'monthly', // ou 'annual'
    user_email: 'cliente@exemplo.com',
    user_name: 'Nome do Cliente',
    organization_name: 'Empresa do Cliente',
    cpf_cnpj: '12345678901', // opcional
    phone: '+5511999999999' // opcional
  })
})

const result = await response.json()
if (result.success) {
  // Redirecionar para checkout
  window.location.href = result.checkout_url
}
```

### 3. Consultar Status

```typescript
// GET /api/subscriptions/status/[intentId]
const statusResponse = await fetch(`/api/subscriptions/status/${intentId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const status = await statusResponse.json()
console.log('Status:', status.status) // pending, processing, completed, failed, expired
```

### 4. WebSocket para Status em Tempo Real

```typescript
// Conectar ao WebSocket
const ws = new WebSocket(`wss://seu-dominio.com/api/subscriptions/status/${intentId}/stream`)

ws.onmessage = (event) => {
  const update = JSON.parse(event.data)
  console.log('Status atualizado:', update.status)
  
  if (update.status === 'completed') {
    // Pagamento confirmado - redirecionar para dashboard
    window.location.href = '/dashboard'
  }
}

ws.onerror = (error) => {
  console.error('Erro no WebSocket:', error)
}
```

## Configuração de Webhooks

### 1. Configurar no Painel Iugu

1. Acesse o painel do Iugu
2. Vá em Configurações > Webhooks
3. Adicione a URL: `https://seu-dominio.com/api/webhooks/iugu`
4. Selecione os eventos:
   - `invoice.status_changed`
   - `subscription.activated`
   - `subscription.suspended`
   - `subscription.expired`

### 2. Validação de Webhook

O sistema valida automaticamente a assinatura HMAC:

```typescript
// Exemplo de validação manual
import crypto from 'crypto'

function validateWebhookSignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.IUGU_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
```

## Componentes React

### 1. Componente de Checkout

```typescript
// components/checkout/CheckoutForm.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CheckoutFormProps {
  planId: string
  billingCycle: 'monthly' | 'annual'
}

export function CheckoutForm({ planId, billingCycle }: CheckoutFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    user_email: '',
    user_name: '',
    organization_name: '',
    cpf_cnpj: '',
    phone: ''
  })
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/subscriptions/checkout-iugu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_id: planId,
          billing_cycle: billingCycle,
          ...formData
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // Redirecionar para página de status
        router.push(`/checkout/status/${result.intent_id}`)
      } else {
        alert('Erro: ' + result.error)
      }
    } catch (error) {
      alert('Erro ao processar checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        value={formData.user_email}
        onChange={(e) => setFormData({...formData, user_email: e.target.value})}
        required
      />
      
      <input
        type="text"
        placeholder="Nome completo"
        value={formData.user_name}
        onChange={(e) => setFormData({...formData, user_name: e.target.value})}
        required
      />
      
      <input
        type="text"
        placeholder="Nome da empresa"
        value={formData.organization_name}
        onChange={(e) => setFormData({...formData, organization_name: e.target.value})}
        required
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Processando...' : 'Finalizar Compra'}
      </button>
    </form>
  )
}
```

### 2. Componente de Status

```typescript
// components/checkout/StatusPage.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface StatusPageProps {
  intentId: string
}

export function StatusPage({ intentId }: StatusPageProps) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Polling para status
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/subscriptions/status/${intentId}`)
        const data = await response.json()
        setStatus(data)
        
        if (data.status === 'completed') {
          // Pagamento confirmado
          setTimeout(() => {
            router.push('/dashboard')
          }, 3000)
        } else if (data.status === 'failed' || data.status === 'expired') {
          // Falha ou expiração
          setLoading(false)
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error)
      }
    }

    // Verificar imediatamente
    checkStatus()
    
    // Verificar a cada 5 segundos
    const interval = setInterval(checkStatus, 5000)
    
    return () => clearInterval(interval)
  }, [intentId, router])

  if (!status) {
    return <div>Carregando...</div>
  }

  return (
    <div className="text-center">
      {status.status === 'pending' && (
        <div>
          <h2>Aguardando pagamento...</h2>
          <p>Você será redirecionado automaticamente após a confirmação.</p>
        </div>
      )}
      
      {status.status === 'processing' && (
        <div>
          <h2>Processando pagamento...</h2>
          <p>Estamos confirmando seu pagamento. Aguarde alguns instantes.</p>
        </div>
      )}
      
      {status.status === 'completed' && (
        <div>
          <h2>Pagamento confirmado! ✅</h2>
          <p>Sua conta foi criada com sucesso. Redirecionando...</p>
        </div>
      )}
      
      {status.status === 'failed' && (
        <div>
          <h2>Falha no pagamento ❌</h2>
          <p>Houve um problema com seu pagamento. Tente novamente.</p>
          <button onClick={() => window.location.reload()}>
            Tentar Novamente
          </button>
        </div>
      )}
      
      {status.status === 'expired' && (
        <div>
          <h2>Sessão expirada ⏰</h2>
          <p>O tempo para pagamento expirou. Inicie um novo checkout.</p>
          <button onClick={() => router.push('/plans')}>
            Escolher Plano
          </button>
        </div>
      )}
    </div>
  )
}
```

## Hooks Personalizados

### 1. Hook para Checkout

```typescript
// hooks/useCheckout.ts
import { useState } from 'react'

interface CheckoutData {
  plan_id: string
  billing_cycle: 'monthly' | 'annual'
  user_email: string
  user_name: string
  organization_name: string
  cpf_cnpj?: string
  phone?: string
}

export function useCheckout() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createCheckout = async (data: CheckoutData) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/subscriptions/checkout-iugu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error)
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    createCheckout,
    loading,
    error
  }
}
```

### 2. Hook para Status

```typescript
// hooks/usePaymentStatus.ts
import { useEffect, useState } from 'react'

export function usePaymentStatus(intentId: string) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!intentId) return

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/subscriptions/status/${intentId}`)
        
        if (!response.ok) {
          throw new Error('Falha ao buscar status')
        }

        const data = await response.json()
        setStatus(data)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setLoading(false)
      }
    }

    // Buscar imediatamente
    fetchStatus()

    // Polling apenas se não for status final
    const interval = setInterval(() => {
      if (status?.is_final) {
        clearInterval(interval)
        return
      }
      fetchStatus()
    }, 5000)

    return () => clearInterval(interval)
  }, [intentId, status?.is_final])

  return { status, loading, error }
}
```

## Testes

### 1. Teste de Integração

```typescript
// __tests__/checkout-integration.test.ts
import { describe, it, expect } from '@jest/globals'

describe('Checkout Integration', () => {
  it('should create checkout successfully', async () => {
    const checkoutData = {
      plan_id: 'test-plan-id',
      billing_cycle: 'monthly' as const,
      user_email: 'test@example.com',
      user_name: 'Test User',
      organization_name: 'Test Org'
    }

    const response = await fetch('/api/subscriptions/checkout-iugu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutData)
    })

    const result = await response.json()
    
    expect(response.ok).toBe(true)
    expect(result.success).toBe(true)
    expect(result.intent_id).toBeDefined()
    expect(result.checkout_url).toBeDefined()
  })

  it('should validate required fields', async () => {
    const invalidData = {
      plan_id: 'test-plan-id'
      // campos obrigatórios faltando
    }

    const response = await fetch('/api/subscriptions/checkout-iugu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidData)
    })

    const result = await response.json()
    
    expect(response.ok).toBe(false)
    expect(result.success).toBe(false)
    expect(result.error).toContain('validation')
  })
})
```

### 2. Teste de Webhook

```typescript
// __tests__/webhook.test.ts
import { describe, it, expect } from '@jest/globals'
import crypto from 'crypto'

describe('Webhook Processing', () => {
  it('should process invoice.status_changed webhook', async () => {
    const payload = {
      event: 'invoice.status_changed',
      data: {
        id: 'test-invoice-id',
        status: 'paid',
        subscription_id: 'test-subscription-id'
      }
    }

    const payloadString = JSON.stringify(payload)
    const signature = crypto
      .createHmac('sha256', process.env.IUGU_WEBHOOK_SECRET!)
      .update(payloadString)
      .digest('hex')

    const response = await fetch('/api/webhooks/iugu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Iugu-Signature': signature
      },
      body: payloadString
    })

    const result = await response.json()
    
    expect(response.ok).toBe(true)
    expect(result.received).toBe(true)
    expect(result.processed).toBe(true)
  })
})
```

## Monitoramento

### 1. Health Checks

```typescript
// Verificar saúde do sistema
const healthResponse = await fetch('/api/health/checkout')
const health = await healthResponse.json()

console.log('Sistema saudável:', health.healthy)
console.log('Componentes:', health.components)
```

### 2. Métricas

```typescript
// Obter métricas do sistema
const metricsResponse = await fetch('/api/admin/subscription-intents/analytics')
const metrics = await metricsResponse.json()

console.log('Taxa de conversão:', metrics.conversion_rate)
console.log('Tempo médio:', metrics.avg_completion_time)
```

## Troubleshooting

### Problemas Comuns

1. **Erro 401 - Não autorizado**
   - Verificar token JWT válido
   - Verificar configuração do Supabase

2. **Erro 400 - Dados inválidos**
   - Verificar campos obrigatórios
   - Validar formato de email/CPF

3. **Erro 502 - Gateway error**
   - Verificar conectividade com Iugu
   - Verificar credenciais da API

4. **Webhook não processado**
   - Verificar configuração no painel Iugu
   - Verificar secret do webhook

### Logs Úteis

```bash
# Logs da aplicação
tail -f /var/log/app/checkout.log

# Logs de webhook
tail -f /var/log/app/webhook.log

# Logs do banco
tail -f /var/log/postgresql/postgresql.log
```

Este guia deve ser atualizado conforme novas funcionalidades são adicionadas ao sistema.