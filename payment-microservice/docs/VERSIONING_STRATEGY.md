# API Versioning Strategy

## Overview

This document outlines the versioning strategy for the Payment Microservice API, ensuring backward compatibility and smooth migration paths for clients.

## Versioning Approach

### Semantic Versioning (SemVer)

We follow semantic versioning (MAJOR.MINOR.PATCH) for all releases:

- **MAJOR**: Breaking changes that require client updates
- **MINOR**: New features that are backward compatible
- **PATCH**: Bug fixes and security updates

### API Versioning

#### URL-based Versioning

```
/api/v1/payments
/api/v2/payments
```

#### Header-based Versioning (Alternative)

```
Accept: application/vnd.payment-api.v1+json
Accept: application/vnd.payment-api.v2+json
```

## Version Lifecycle

### Support Timeline

- **Current Version (v2.x)**: Full support, new features
- **Previous Version (v1.x)**: Maintenance mode, security fixes only
- **Legacy Version (v0.x)**: Deprecated, 6-month sunset period

### Deprecation Process

1. **Announcement**: 6 months before deprecation
2. **Warning Headers**: Add deprecation warnings to responses
3. **Migration Guide**: Provide detailed migration documentation
4. **Sunset**: Remove deprecated endpoints

## Breaking Changes Policy

### What Constitutes a Breaking Change

- Removing or renaming fields in responses
- Changing field types or formats
- Removing endpoints
- Changing authentication requirements
- Modifying error response structures

### Non-Breaking Changes

- Adding new optional fields
- Adding new endpoints
- Adding new optional query parameters
- Improving error messages (keeping structure)

## Migration Guides

### v1 to v2 Migration

#### Key Changes

1. **Authentication**: JWT tokens now required for all endpoints
2. **Response Format**: Standardized error responses
3. **Field Changes**: 
   - `payment_id` → `id`
   - `created_date` → `created_at`
   - `status_code` → `status`

#### Migration Steps

```javascript
// v1 Request
POST /api/v1/payments
{
  "amount": 1000,
  "currency": "BRL",
  "payment_method": "credit_card"
}

// v2 Request
POST /api/v2/payments
{
  "amount": 1000,
  "currency": "BRL",
  "paymentMethod": "credit_card",
  "organizationId": "org_123"
}
```

#### Response Changes

```javascript
// v1 Response
{
  "payment_id": "pay_123",
  "status_code": "pending",
  "created_date": "2024-01-01T00:00:00Z"
}

// v2 Response
{
  "id": "pay_123",
  "status": "pending",
  "createdAt": "2024-01-01T00:00:00Z",
  "organizationId": "org_123"
}
```

## Backward Compatibility

### Compatibility Matrix

| Client Version | API v1 | API v2 | API v3 |
|---------------|--------|--------|--------|
| 1.x           | ✅     | ❌     | ❌     |
| 2.x           | ✅     | ✅     | ❌     |
| 3.x           | ⚠️     | ✅     | ✅     |

Legend:
- ✅ Fully supported
- ⚠️ Limited support (deprecated)
- ❌ Not supported

### Compatibility Layers

```typescript
// Compatibility middleware for v1 clients
export const v1CompatibilityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Transform v1 request format to v2
  if (req.path.startsWith('/api/v1/')) {
    req.body = transformV1ToV2Request(req.body);
  }
  
  // Transform v2 response back to v1 format
  const originalSend = res.send;
  res.send = function(data) {
    if (req.path.startsWith('/api/v1/')) {
      data = transformV2ToV1Response(data);
    }
    return originalSend.call(this, data);
  };
  
  next();
};
```

## Version Detection

### Client Version Headers

```typescript
interface VersionHeaders {
  'X-API-Version': string;
  'X-Client-Version': string;
  'User-Agent': string;
}
```

### Automatic Version Detection

```typescript
export const detectClientVersion = (req: Request): string => {
  // Check explicit version header
  if (req.headers['x-api-version']) {
    return req.headers['x-api-version'] as string;
  }
  
  // Check URL path
  const pathVersion = req.path.match(/\/api\/v(\d+)\//);
  if (pathVersion) {
    return pathVersion[1];
  }
  
  // Check Accept header
  const acceptHeader = req.headers.accept;
  const acceptVersion = acceptHeader?.match(/vnd\.payment-api\.v(\d+)/);
  if (acceptVersion) {
    return acceptVersion[1];
  }
  
  // Default to latest stable version
  return '2';
};
```

## Deprecation Notices

### Response Headers

```typescript
export const addDeprecationHeaders = (res: Response, version: string) => {
  if (version === '1') {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', '2024-12-31T23:59:59Z');
    res.setHeader('Link', '</api/v2/migration-guide>; rel="successor-version"');
  }
};
```

### Deprecation Timeline

| Version | Status | Deprecation Date | Sunset Date |
|---------|--------|------------------|-------------|
| v1.0    | Deprecated | 2024-06-01 | 2024-12-31 |
| v1.1    | Deprecated | 2024-06-01 | 2024-12-31 |
| v2.0    | Current | - | - |
| v2.1    | Current | - | - |

## Implementation Guidelines

### Version-Specific Controllers

```typescript
// v1/payment.controller.ts
@Controller('/api/v1/payments')
export class PaymentControllerV1 {
  @Post()
  async createPayment(@Body() request: PaymentRequestV1): Promise<PaymentResponseV1> {
    // v1 implementation
  }
}

// v2/payment.controller.ts
@Controller('/api/v2/payments')
export class PaymentControllerV2 {
  @Post()
  async createPayment(@Body() request: PaymentRequestV2): Promise<PaymentResponseV2> {
    // v2 implementation
  }
}
```

### Shared Business Logic

```typescript
// Shared service used by all versions
@Injectable()
export class PaymentService {
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Core business logic remains version-agnostic
  }
}
```

## Testing Strategy

### Version Compatibility Tests

```typescript
describe('API Version Compatibility', () => {
  test('v1 clients can still create payments', async () => {
    const v1Request = {
      amount: 1000,
      currency: 'BRL',
      payment_method: 'credit_card'
    };
    
    const response = await request(app)
      .post('/api/v1/payments')
      .send(v1Request)
      .expect(200);
      
    expect(response.body).toHaveProperty('payment_id');
    expect(response.body).toHaveProperty('status_code');
  });
  
  test('v2 clients receive enhanced responses', async () => {
    const v2Request = {
      amount: 1000,
      currency: 'BRL',
      paymentMethod: 'credit_card',
      organizationId: 'org_123'
    };
    
    const response = await request(app)
      .post('/api/v2/payments')
      .send(v2Request)
      .expect(200);
      
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('organizationId');
  });
});
```

## Monitoring and Analytics

### Version Usage Metrics

```typescript
export const trackVersionUsage = (version: string, endpoint: string) => {
  metrics.counter('api_version_usage', {
    version,
    endpoint,
    timestamp: new Date().toISOString()
  }).inc();
};
```

### Migration Progress Tracking

```typescript
export const trackMigrationProgress = () => {
  const v1Usage = metrics.getCounter('api_version_usage', { version: 'v1' });
  const v2Usage = metrics.getCounter('api_version_usage', { version: 'v2' });
  
  const migrationPercentage = (v2Usage / (v1Usage + v2Usage)) * 100;
  
  metrics.gauge('migration_progress_percentage').set(migrationPercentage);
};
```

## Communication Strategy

### Client Notification Process

1. **Email Notifications**: Send to registered developers
2. **API Response Headers**: Include deprecation warnings
3. **Documentation Updates**: Update all relevant docs
4. **Blog Posts**: Announce major version releases
5. **Slack/Discord**: Direct communication with integration partners

### Migration Support

- **Office Hours**: Weekly sessions for migration questions
- **Migration Tools**: Automated request/response transformers
- **Sandbox Environment**: Test migrations safely
- **Priority Support**: Dedicated support during migration periods