# Admin API Documentation

## Overview

The Admin API provides administrative functionality for the Payment Microservice, including provider management, financial reporting, audit logs, and system alerts.

## Authentication

All admin endpoints require JWT authentication with appropriate permissions.

### JWT Token Format

```json
{
  "sub": "user_id",
  "email": "admin@example.com",
  "role": "super_admin|admin|viewer",
  "organizationId": "org_123",
  "permissions": ["dashboard:read", "providers:write", ...],
  "iat": 1640995200,
  "exp": 1641081600
}
```

### Roles and Permissions

- **super_admin**: Full access to all resources across all organizations
- **admin**: Full access within their organization
- **viewer**: Read-only access within their organization

## Endpoints

### Dashboard

#### GET /api/v1/admin/dashboard
Get admin dashboard overview with system metrics and alerts.

**Required Permission:** `dashboard:read`

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalProviders": 4,
      "healthyProviders": 3,
      "totalTransactions": 15000,
      "successRate": 96.5,
      "averageResponseTime": 250
    },
    "providers": [...],
    "metrics": {...},
    "recentTransactions": [...],
    "alerts": [...],
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### Provider Management

#### GET /api/v1/admin/providers
Get detailed information about all payment providers.

**Required Permission:** `providers:read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "stripe",
      "version": "1.0.0",
      "status": "healthy",
      "responseTime": 200,
      "errorRate": 1.5,
      "totalTransactions": 8000,
      "configuration": {
        "isActive": true,
        "priority": 1,
        "webhookUrl": "https://api.stripe.com/webhooks"
      },
      "capabilities": {
        "payments": true,
        "subscriptions": true,
        "refunds": true,
        "webhooks": true
      }
    }
  ]
}
```

#### PUT /api/v1/admin/providers/:name/config
Update provider configuration.

**Required Permission:** `providers:write`

**Request Body:**
```json
{
  "isActive": true,
  "priority": 1,
  "credentials": {
    "apiKey": "sk_mock_...",
    "secretKey": "..."
  },
  "settings": {
    "webhookUrl": "https://example.com/webhooks",
    "timeout": 30000
  }
}
```

### Reports

#### GET /api/v1/admin/reports/financial
Generate consolidated financial reports.

**Required Permission:** `reports:read`

**Query Parameters:**
- `startDate` (ISO date string)
- `endDate` (ISO date string)
- `groupBy` (hour|day|week|month)
- `providers` (comma-separated list)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTransactions": 1250,
      "totalAmount": 125000.50,
      "successfulTransactions": 1200,
      "failedTransactions": 50,
      "successRate": 96.0,
      "averageTransactionAmount": 100.00,
      "totalFees": 2500.10
    },
    "byProvider": [...],
    "byPeriod": [...],
    "byCurrency": [...],
    "topTransactions": [...]
  }
}
```

#### GET /api/v1/admin/reports/performance
Generate provider performance reports.

**Required Permission:** `reports:read`

**Query Parameters:**
- `startDate` (ISO date string)
- `endDate` (ISO date string)
- `providers` (comma-separated list)

### Audit Logs

#### GET /api/v1/admin/audit-logs
Retrieve audit logs with filtering options.

**Required Permission:** `audit:read`

**Query Parameters:**
- `startDate` (ISO date string)
- `endDate` (ISO date string)
- `userId` (string)
- `action` (string)
- `resourceType` (string)
- `limit` (number, default: 100)
- `offset` (number, default: 0)

### Alerts

#### GET /api/v1/admin/alerts
Get system alerts with filtering options.

**Required Permission:** `alerts:read`

**Query Parameters:**
- `status` (active|acknowledged|resolved)
- `severity` (low|medium|high|critical)
- `limit` (number, default: 50)

#### POST /api/v1/admin/alerts/:id/acknowledge
Acknowledge a system alert.

**Required Permission:** `alerts:write`

**Request Body:**
```json
{
  "note": "Investigating the issue"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "correlationId": "req_123456789"
}
```

### Common HTTP Status Codes

- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `400 Bad Request`: Invalid request parameters
- `500 Internal Server Error`: Server error

## Rate Limiting

Admin endpoints are rate-limited to prevent abuse:
- 100 requests per minute per user
- 1000 requests per hour per organization

## Security Considerations

1. **JWT Tokens**: Use secure, signed JWT tokens with appropriate expiration
2. **HTTPS Only**: All admin endpoints must be accessed over HTTPS
3. **IP Whitelisting**: Consider restricting admin access to specific IP ranges
4. **Audit Logging**: All admin actions are automatically logged
5. **Permission Checks**: Every endpoint validates user permissions
6. **Data Masking**: Sensitive data is masked in responses and logs

## Example Usage

### Authenticating and Getting Dashboard

```bash
# Get JWT token (implementation depends on your auth system)
TOKEN="<jwt_token_here>"

# Get dashboard data
curl -H "Authorization: Bearer $TOKEN" \
     https://api.example.com/api/v1/admin/dashboard
```

### Updating Provider Configuration

```bash
curl -X PUT \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"isActive": true, "priority": 1}' \
     https://api.example.com/api/v1/admin/providers/stripe/config
```

### Generating Financial Report

```bash
curl -H "Authorization: Bearer $TOKEN" \
     "https://api.example.com/api/v1/admin/reports/financial?startDate=2024-01-01&endDate=2024-01-31&groupBy=day"
```
