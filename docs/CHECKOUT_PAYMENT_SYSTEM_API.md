# API Documentation - Sistema de Checkout e Pagamentos

## Visão Geral

Este documento descreve as APIs do sistema completo de checkout e pagamentos, incluindo criação de intenções de assinatura, processamento de webhooks, e gerenciamento de status de pagamento.

## Autenticação

Todas as APIs requerem autenticação via Supabase Auth, exceto onde especificado.

```typescript
// Headers obrigatórios
{
  "Authorization": "Bearer <supabase_jwt_token>",
  "Content-Type": "application/json"
}
```

## APIs de Checkout

### POST /api/subscriptions/checkout-iugu

Cria uma nova sessão de checkout e intenção de assinatura.

**Requisitos:** 1.1, 1.2, 1.3

#### Request Body

```typescript
interface CheckoutRequest {
  plan_id: string;                    // UUID do plano de assinatura
  billing_cycle: 'monthly' | 'annual'; // Ciclo de cobrança
  user_email: string;                 // Email do usuário (validado)
  user_name: string;                  // Nome completo (2-100 chars)
  organization_name: string;          // Nome da organização (2-100 chars)
  cpf_cnpj?: string;                 // CPF (11 dígitos) ou CNPJ (14 dígitos)
  phone?: string;                    // Telefone no formato internacional
  metadata?: Record<string, any>;     // Dados adicionais opcionais
}
```

#### Response (Success - 200)

```typescript
interface CheckoutResponse {
  success: true;
  intent_id: string;                  // ID da intenção de assinatura
  checkout_url: string;               // URL de pagamento no Iugu
  status_url: string;                 // URL para consultar status
  expires_at: string;                 // Data de expiração (ISO 8601)
  plan: {
    id: string;
    name: string;
    price: number;                    // Preço em reais
    billing_cycle: string;
  };
  customer: {
    id: string;                       // ID do cliente no Iugu
    email: string;
    name: string;
  };
  metadata: {
    processing_time_ms: number;
    created_at: string;
  };
}
```

#### Response (Error - 400/500)

```typescript
interface CheckoutErrorResponse {
  success: false;
  error: string;                      // Mensagem de erro principal
  details?: string;                   // Detalhes adicionais
  code: string;                       // Código do erro
  field?: string;                     // Campo com erro (validação)
  timestamp: string;
  metadata?: {
    processing_time_ms: number;
  };
}
```

#### Códigos de Erro

- `VALIDATION_ERROR`: Dados de entrada inválidos
- `INVALID_PLAN`: Plano não encontrado ou inativo
- `PAYMENT_GATEWAY_ERROR`: Erro no Iugu
- `INTERNAL_ERROR`: Erro interno do servidor

#### Exemplo de Uso

```bash
curl -X POST /api/subscriptions/checkout-iugu \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": "123e4567-e89b-12d3-a456-426614174000",
    "billing_cycle": "monthly",
    "user_email": "usuario@exemplo.com",
    "user_name": "João Silva",
    "organization_name": "Empresa ABC",
    "cpf_cnpj": "12345678901",
    "phone": "+5511999999999"
  }'
```

## APIs de Status

### GET /api/subscriptions/status/[intentId]

Consulta o status detalhado de uma intenção de assinatura.

**Requisitos:** 2.5, 5.3

#### Response (Success - 200)

```typescript
interface StatusResponse {
  success: true;
  intent_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  is_final: boolean;                  // Se o status é final
  is_expired: boolean;                // Se a intenção expirou
  plan: {
    id: string;
    name: string;
    description: string;
    price: number;
    billing_cycle: string;
  };
  customer: {
    email: string;
    name: string;
    organization: string;
    phone?: string;
    cpf_cnpj?: string;
  };
  payment: {
    checkout_url?: string;
    iugu_customer_id?: string;
    iugu_subscription_id?: string;
  };
  timeline: {
    created_at: string;
    updated_at: string;
    expires_at: string;
    completed_at?: string;
    time_remaining_ms: number;
    transitions: TransitionEvent[];
  };
  actions: {
    next_possible_states: string[];
    can_retry: boolean;
    can_cancel: boolean;
    needs_payment: boolean;
  };
  metadata: Record<string, any>;
  timestamp: string;
}
```

### GET /api/subscriptions/status/public

Consulta pública de status por email ou CPF (sem autenticação).

**Requisitos:** 2.5, 5.3

#### Query Parameters

- `email`: Email do usuário
- `cpf_cnpj`: CPF ou CNPJ do usuário

```bash
curl "/api/subscriptions/status/public?email=usuario@exemplo.com"
```

### GET /api/subscriptions/status/[intentId]/stream

WebSocket para updates em tempo real do status.

**Requisitos:** 2.5, 5.2

```typescript
// Conectar ao WebSocket
const ws = new WebSocket('/api/subscriptions/status/123/stream');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Status update:', update);
};
```

## APIs de Recuperação

### POST /api/subscriptions/recovery/regenerate

Gera nova cobrança para intenção expirada.

**Requisitos:** 5.1, 5.2

#### Request Body

```typescript
interface RegenerateRequest {
  intent_id: string;
  extend_expiration?: boolean;        // Estender prazo de expiração
}
```

### POST /api/subscriptions/recovery/resend-email

Reenvia email de confirmação.

**Requisitos:** 5.1, 5.2

#### Request Body

```typescript
interface ResendEmailRequest {
  intent_id: string;
  email_type: 'confirmation' | 'payment_reminder' | 'welcome';
}
```

### POST /api/subscriptions/recovery/cancel

Cancela intenção de assinatura.

**Requisitos:** 5.1, 5.2

#### Request Body

```typescript
interface CancelRequest {
  intent_id: string;
  reason: string;
  notify_customer?: boolean;
}
```

## Webhook do Iugu

### POST /api/webhooks/iugu

Endpoint para receber webhooks do Iugu (sem autenticação).

**Requisitos:** 2.1, 4.1, 8.1

#### Eventos Suportados

- `invoice.status_changed`: Mudança de status de fatura
- `subscription.activated`: Assinatura ativada
- `subscription.suspended`: Assinatura suspensa
- `subscription.expired`: Assinatura expirada
- `subscription.canceled`: Assinatura cancelada

#### Request Body (Iugu Format)

```typescript
interface IuguWebhook {
  event: string;
  data: {
    id: string;
    status?: string;
    subscription_id?: string;
    customer_id?: string;
    // ... outros campos específicos do evento
  };
}
```

#### Response

```typescript
interface WebhookResponse {
  received: boolean;
  processed: boolean;
  event_id: string;
  processing_time: number;
  status?: string;
  error?: string;
  retryable?: boolean;
}
```

## Rate Limiting

Todas as APIs têm rate limiting aplicado:

- **Checkout**: 10 requests/minuto por IP
- **Status**: 60 requests/minuto por usuário
- **Recovery**: 5 requests/minuto por intent
- **Webhook**: Sem limite (confiável)

## Códigos de Status HTTP

- `200`: Sucesso
- `400`: Dados inválidos
- `401`: Não autenticado
- `403`: Não autorizado
- `404`: Recurso não encontrado
- `429`: Rate limit excedido
- `500`: Erro interno
- `502`: Erro no gateway de pagamento

## Monitoramento e Logs

Todas as APIs geram logs estruturados com:

- Request ID único
- Tempo de processamento
- Status de resposta
- Dados de erro (quando aplicável)
- Métricas de performance

### Exemplo de Log

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "checkout-api",
  "request_id": "req_123456",
  "endpoint": "/api/subscriptions/checkout-iugu",
  "method": "POST",
  "user_id": "user_789",
  "processing_time_ms": 1250,
  "status": 200,
  "intent_id": "intent_abc123"
}
```

## Versionamento

As APIs seguem versionamento semântico:

- **v1.0**: Versão inicial
- **v1.1**: Adição de recovery APIs
- **v1.2**: WebSocket para status em tempo real

Mudanças breaking são introduzidas apenas em versões major.