# Payment Microservice API Documentation

## Overview

The Payment Microservice provides a unified API for processing payments across multiple providers (Stripe, Iugu, PagSeguro, Mercado Pago). This document describes all available endpoints, request/response formats, and integration patterns.

## Base URL

- **Production**: `https://api.payment-service.com`
- **Staging**: `https://staging-api.payment-service.com`
- **Development**: `http://localhost:3000`

## Authentication

All API requests require authentication using JWT tokens in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Obtaining Access Tokens

```http
POST /api/v2/auth/token
Content-Type: application/json

{
  "clientId": "your_client_id",
  "clientSecret": "your_client_secret",
  "organizationId": "org_123"
}
```

**Response:**
```json
{
  "accessToken": "<jwt_token_here>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "refreshToken": "refresh_token_here"
}
```

## API Versioning

The API supports multiple versions through URL versioning:

- **v1**: `/api/v1/` (Deprecated, sunset date: 2024-12-31)
- **v2**: `/api/v2/` (Current stable version)

## Rate Limiting

API requests are rate-limited per organization:

- **Standard Plan**: 1,000 requests per minute
- **Premium Plan**: 5,000 requests per minute
- **Enterprise Plan**: Custom limits

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Payments API

### Create Payment

Creates a new payment transaction.

```http
POST /api/v2/payments
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 1000,
  "currency": "BRL",
  "paymentMethod": "credit_card",
  "organizationId": "org_123",
  "customerId": "cust_456",
  "description": "Product purchase",
  "metadata": {
    "orderId": "order_789",
    "productId": "prod_101"
  },
  "returnUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel"
}
```

**Response (201 Created):**
```json
{
  "id": "pay_abc123",
  "status": "pending",
  "amount": 1000,
  "currency": "BRL",
  "paymentMethod": "credit_card",
  "organizationId": "org_123",
  "customerId": "cust_456",
  "description": "Product purchase",
  "metadata": {
    "orderId": "order_789",
    "productId": "prod_101"
  },
  "providerName": "stripe",
  "providerTransactionId": "pi_1234567890",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "paymentUrl": "https://checkout.stripe.com/pay/cs_test_123"
}
```

### Get Payment

Retrieves a specific payment by ID.

```http
GET /api/v2/payments/{paymentId}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "pay_abc123",
  "status": "completed",
  "amount": 1000,
  "currency": "BRL",
  "paymentMethod": "credit_card",
  "organizationId": "org_123",
  "customerId": "cust_456",
  "description": "Product purchase",
  "metadata": {
    "orderId": "order_789",
    "productId": "prod_101"
  },
  "providerName": "stripe",
  "providerTransactionId": "pi_1234567890",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z",
  "completedAt": "2024-01-15T10:35:00Z"
}
```

### List Payments

Retrieves a paginated list of payments.

```http
GET /api/v2/payments?page=1&limit=20&status=completed&provider=stripe
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by status (pending, completed, failed, refunded)
- `provider` (optional): Filter by provider name
- `customerId` (optional): Filter by customer ID
- `startDate` (optional): Filter by creation date (ISO 8601)
- `endDate` (optional): Filter by creation date (ISO 8601)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "pay_abc123",
      "status": "completed",
      "amount": 1000,
      "currency": "BRL",
      "paymentMethod": "credit_card",
      "organizationId": "org_123",
      "customerId": "cust_456",
      "providerName": "stripe",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Refund Payment

Creates a refund for a completed payment.

```http
POST /api/v2/payments/{paymentId}/refund
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 500,
  "reason": "customer_request",
  "metadata": {
    "refundRequestId": "req_123"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "ref_xyz789",
  "paymentId": "pay_abc123",
  "status": "pending",
  "amount": 500,
  "currency": "BRL",
  "reason": "customer_request",
  "metadata": {
    "refundRequestId": "req_123"
  },
  "providerRefundId": "re_1234567890",
  "createdAt": "2024-01-15T11:00:00Z"
}
```

## Subscriptions API

### Create Subscription

Creates a new recurring subscription.

```http
POST /api/v2/subscriptions
Content-Type: application/json
Authorization: Bearer <token>

{
  "customerId": "cust_456",
  "planId": "plan_monthly_premium",
  "organizationId": "org_123",
  "trialDays": 7,
  "metadata": {
    "campaignId": "camp_123"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "sub_def456",
  "customerId": "cust_456",
  "planId": "plan_monthly_premium",
  "organizationId": "org_123",
  "status": "trialing",
  "currentPeriodStart": "2024-01-15T10:30:00Z",
  "currentPeriodEnd": "2024-02-15T10:30:00Z",
  "trialEnd": "2024-01-22T10:30:00Z",
  "providerName": "stripe",
  "providerSubscriptionId": "sub_1234567890",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Update Subscription

Updates an existing subscription.

```http
PATCH /api/v2/subscriptions/{subscriptionId}
Content-Type: application/json
Authorization: Bearer <token>

{
  "planId": "plan_yearly_premium",
  "metadata": {
    "upgradeReason": "customer_request"
  }
}
```

### Cancel Subscription

Cancels an active subscription.

```http
DELETE /api/v2/subscriptions/{subscriptionId}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "sub_def456",
  "status": "canceled",
  "canceledAt": "2024-01-15T12:00:00Z",
  "cancelAtPeriodEnd": true
}
```

## Providers API

### List Providers

Retrieves available payment providers and their status.

```http
GET /api/v2/providers
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "name": "stripe",
      "displayName": "Stripe",
      "status": "active",
      "priority": 1,
      "supportedMethods": ["credit_card", "debit_card", "pix"],
      "supportedCurrencies": ["BRL", "USD", "EUR"],
      "healthStatus": "healthy",
      "lastHealthCheck": "2024-01-15T12:00:00Z"
    },
    {
      "name": "iugu",
      "displayName": "Iugu",
      "status": "active",
      "priority": 2,
      "supportedMethods": ["credit_card", "boleto", "pix"],
      "supportedCurrencies": ["BRL"],
      "healthStatus": "healthy",
      "lastHealthCheck": "2024-01-15T12:00:00Z"
    }
  ]
}
```

### Get Provider Health

Checks the health status of a specific provider.

```http
GET /api/v2/providers/{providerName}/health
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "name": "stripe",
  "status": "healthy",
  "responseTime": 150,
  "lastCheck": "2024-01-15T12:00:00Z",
  "details": {
    "apiConnectivity": "ok",
    "webhookEndpoint": "ok",
    "credentialsValid": true
  }
}
```

## Webhooks API

### Configure Webhook

Configures webhook endpoints for receiving payment events.

```http
POST /api/v2/webhooks
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "https://yoursite.com/webhooks/payments",
  "events": ["payment.completed", "payment.failed", "subscription.created"],
  "secret": "your_webhook_secret"
}
```

**Response (201 Created):**
```json
{
  "id": "wh_123456",
  "url": "https://yoursite.com/webhooks/payments",
  "events": ["payment.completed", "payment.failed", "subscription.created"],
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Webhook Event Format

All webhook events follow this format:

```json
{
  "id": "evt_123456",
  "type": "payment.completed",
  "createdAt": "2024-01-15T10:35:00Z",
  "data": {
    "object": {
      "id": "pay_abc123",
      "status": "completed",
      "amount": 1000,
      "currency": "BRL",
      "organizationId": "org_123"
    }
  },
  "organizationId": "org_123"
}
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "PAYMENT_DECLINED",
    "message": "The payment was declined by the provider",
    "details": {
      "providerCode": "card_declined",
      "providerMessage": "Your card was declined."
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `PAYMENT_DECLINED` | 402 | Payment declined by provider |
| `PROVIDER_ERROR` | 502 | Provider API error |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |

## SDKs and Libraries

### Node.js SDK

```bash
npm install @payment-service/node-sdk
```

```javascript
const PaymentService = require('@payment-service/node-sdk');

const client = new PaymentService({
  apiKey: 'your_api_key',
  baseUrl: 'https://api.payment-service.com'
});

// Create payment
const payment = await client.payments.create({
  amount: 1000,
  currency: 'BRL',
  paymentMethod: 'credit_card',
  organizationId: 'org_123'
});
```

### Python SDK

```bash
pip install payment-service-python
```

```python
import payment_service

client = payment_service.Client(
    api_key='your_api_key',
    base_url='https://api.payment-service.com'
)

# Create payment
payment = client.payments.create(
    amount=1000,
    currency='BRL',
    payment_method='credit_card',
    organization_id='org_123'
)
```

### PHP SDK

```bash
composer require payment-service/php-sdk
```

```php
<?php
use PaymentService\Client;

$client = new Client([
    'api_key' => 'your_api_key',
    'base_url' => 'https://api.payment-service.com'
]);

// Create payment
$payment = $client->payments->create([
    'amount' => 1000,
    'currency' => 'BRL',
    'paymentMethod' => 'credit_card',
    'organizationId' => 'org_123'
]);
?>
```

## Testing

### Sandbox Environment

Use the sandbox environment for testing:

- **Base URL**: `https://sandbox-api.payment-service.com`
- **Test API Key**: Use keys prefixed with `test_`

### Test Cards

Use these test card numbers in sandbox:

| Card Number | Brand | Result |
|-------------|-------|--------|
| 4242424242424242 | Visa | Success |
| 4000000000000002 | Visa | Declined |
| 4000000000009995 | Visa | Insufficient funds |
| 5555555555554444 | Mastercard | Success |

### Webhook Testing

Test webhooks using ngrok or similar tools:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL for webhook configuration
# https://abc123.ngrok.io/webhooks/payments
```

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

- **Interactive Docs**: `https://api.payment-service.com/docs`
- **JSON Spec**: `https://api.payment-service.com/openapi.json`
- **YAML Spec**: `https://api.payment-service.com/openapi.yaml`

## Support

### Documentation
- **API Reference**: https://docs.payment-service.com
- **Integration Guides**: https://docs.payment-service.com/guides
- **SDKs**: https://docs.payment-service.com/sdks

### Support Channels
- **Email**: support@payment-service.com
- **Slack**: #payment-service-support
- **Status Page**: https://status.payment-service.com

### SLA
- **Uptime**: 99.9%
- **Response Time**: < 500ms (95th percentile)
- **Support Response**: < 4 hours (business hours)
