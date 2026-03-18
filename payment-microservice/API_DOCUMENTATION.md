# Payment Microservice API Documentation

## Overview

The Payment Microservice provides a unified API for processing payments through multiple providers (Stripe, Iugu, PagSeguro, Mercado Pago) with automatic failover and comprehensive webhook handling.

## API Versions

### Version 1 (v1) - Stable
- **Base URL**: `/api/v1`
- **Status**: Stable and production-ready
- **Features**: Full CRUD operations, webhook handling, provider management

### Version 2 (v2) - Coming Soon
- **Base URL**: `/api/v2`
- **Status**: In development
- **Expected**: Q2 2024
- **Features**: Batch operations, enhanced filtering, GraphQL support

## Authentication

Currently, the API uses correlation IDs for request tracking. Full authentication will be implemented in future versions.

## REST API Endpoints

### Payments

#### Create Payment
```http
POST /api/v1/payments
Content-Type: application/json

{
  "amount": 1000,
  "currency": "BRL",
  "organizationId": "123e4567-e89b-12d3-a456-426614174000",
  "customerId": "cust_123",
  "description": "Test payment",
  "metadata": {
    "orderId": "order_123"
  }
}
```

#### Get Payment
```http
GET /api/v1/payments/{paymentId}
```

#### List Payments
```http
GET /api/v1/payments?organizationId={orgId}&limit=20&offset=0
```

#### Refund Payment
```http
POST /api/v1/payments/{paymentId}/refund
Content-Type: application/json

{
  "amount": 500,
  "reason": "Customer request"
}
```

#### Capture Payment
```http
POST /api/v1/payments/{paymentId}/capture
Content-Type: application/json

{
  "amount": 1000
}
```

### Subscriptions

#### Create Subscription
```http
POST /api/v1/subscriptions
Content-Type: application/json

{
  "customerId": "cust_123",
  "organizationId": "123e4567-e89b-12d3-a456-426614174000",
  "planId": "plan_basic",
  "amount": 2999,
  "currency": "BRL",
  "billingInterval": "MONTHLY"
}
```

#### Get Subscription
```http
GET /api/v1/subscriptions/{subscriptionId}
```

#### List Subscriptions
```http
GET /api/v1/subscriptions?organizationId={orgId}&customerId={custId}
```

#### Update Subscription
```http
PUT /api/v1/subscriptions/{subscriptionId}
Content-Type: application/json

{
  "amount": 3999,
  "planId": "plan_premium"
}
```

#### Cancel Subscription
```http
DELETE /api/v1/subscriptions/{subscriptionId}
Content-Type: application/json

{
  "cancelAtPeriodEnd": true
}
```

### Providers

#### List Providers
```http
GET /api/v1/providers
```

#### Get Provider Details
```http
GET /api/v1/providers/{providerName}
```

#### Configure Provider
```http
POST /api/v1/providers/{providerName}/configure
Content-Type: application/json

{
  "credentials": {
    "apiKey": "sk_mock_...",
    "secretKey": "..."
  },
  "settings": {
    "webhookUrl": "https://api.example.com/webhooks/stripe"
  },
  "isActive": true,
  "priority": 1
}
```

#### Check Provider Health
```http
GET /api/v1/providers/{providerName}/health
```

#### Test Provider
```http
POST /api/v1/providers/{providerName}/test
Content-Type: application/json

{
  "testAmount": 100,
  "currency": "BRL"
}
```

#### Get All Providers Status
```http
GET /api/v1/providers/status
```

### Webhooks

#### Receive Webhook
```http
POST /api/v1/webhooks/{providerName}
X-Signature: {signature}
Content-Type: application/json

{
  "id": "evt_123",
  "type": "payment.succeeded",
  "data": {
    "id": "pay_123",
    "amount": 1000,
    "status": "succeeded"
  },
  "created": 1640995200
}
```

#### List Webhook Events
```http
GET /api/v1/webhooks/events?providerName={provider}&eventType={type}&limit=50
```

#### Retry Webhook Event
```http
POST /api/v1/webhooks/retry/{eventId}
```

## GraphQL API

### Endpoint
- **URL**: `/graphql`
- **Playground**: Available in development mode

### Sample Queries

#### Get Payment
```graphql
query GetPayment($id: ID!) {
  payment(id: $id) {
    id
    amount
    currency
    status
    createdAt
    provider {
      name
      healthStatus {
        status
        responseTime
      }
    }
  }
}
```

#### List Payments with Filtering
```graphql
query ListPayments($filter: PaymentFilter!, $pagination: PaginationInput) {
  payments(filter: $filter, pagination: $pagination) {
    payments {
      id
      amount
      currency
      status
      createdAt
    }
    pagination {
      total
      hasNext
      hasPrevious
    }
  }
}
```

#### Create Payment
```graphql
mutation CreatePayment($input: PaymentInput!) {
  createPayment(input: $input) {
    id
    status
    amount
    currency
    createdAt
  }
}
```

#### Real-time Subscription
```graphql
subscription PaymentUpdates($organizationId: String!) {
  paymentStatusChanged(organizationId: $organizationId) {
    id
    status
    updatedAt
  }
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "id": "pay_123",
    "status": "succeeded",
    "amount": 1000,
    "currency": "BRL"
  },
  "correlationId": "req_123456789"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Amount must be positive",
  "correlationId": "req_123456789"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "count": 25,
  "pagination": {
    "total": 100,
    "limit": 25,
    "offset": 0,
    "hasNext": true,
    "hasPrevious": false
  },
  "correlationId": "req_123456789"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid signature)
- `404` - Not Found
- `500` - Internal Server Error
- `501` - Not Implemented (v2 endpoints)

## Rate Limiting

Rate limiting is implemented per IP address:
- **Default**: 100 requests per minute
- **Burst**: Up to 200 requests in 10 seconds
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Webhook Security

All webhooks must include a valid signature header:
- **Stripe**: `Stripe-Signature`
- **Iugu**: `Authorization`
- **PagSeguro**: `X-Signature`
- **Mercado Pago**: `X-Signature`

## Error Handling

The API implements comprehensive error handling with:
- Structured error responses
- Correlation ID tracking
- Detailed logging
- Automatic retry for transient failures
- Circuit breaker pattern for provider failures

## Monitoring

### Health Checks
- **Basic**: `GET /health`
- **Readiness**: `GET /ready`
- **Metrics**: `GET /metrics` (Prometheus format)

### Metrics Collected
- Payment processing duration
- Success/failure rates by provider
- Provider health status
- API response times
- Error rates by type

## Development

### Local Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
STRIPE_SECRET_KEY=sk_mock_...
IUGU_API_TOKEN=...
```

## Support

For API support and questions:
- **Documentation**: `/api/v1` (API info endpoint)
- **Health Status**: `/health`
- **Metrics**: `/metrics`
- **GraphQL Playground**: `/graphql` (development only)