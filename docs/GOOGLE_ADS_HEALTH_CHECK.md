# Google Ads Health Check Endpoint

## Overview

The Google Ads Health Check endpoint (`/api/google/health`) provides comprehensive system health monitoring for the Google Ads integration. It validates database connectivity, encryption keys, active connections, and token validation functionality.

## Endpoint

```
GET /api/google/health
```

## Response Format

### Success Response (200 - Healthy)

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "pass",
      "message": "Database connection successful",
      "details": {
        "queryExecuted": true,
        "responseReceived": true
      }
    },
    "encryptionKeys": {
      "status": "pass",
      "message": "Encryption keys properly configured",
      "details": {
        "keyVersion": 1,
        "algorithm": "aes-256-gcm",
        "expiresAt": "2025-01-15T10:30:00.000Z",
        "daysUntilExpiry": 365
      }
    },
    "activeConnections": {
      "status": "pass",
      "message": "Active connections healthy",
      "details": {
        "activeConnections": 5,
        "expiredConnections": 2,
        "oldestConnection": "2024-01-01T00:00:00.000Z"
      }
    },
    "tokenValidation": {
      "status": "pass",
      "message": "Token validation system operational",
      "details": {
        "encryptionTest": "passed",
        "connectionsNeedingRefresh": 0
      }
    }
  },
  "summary": {
    "totalChecks": 4,
    "passedChecks": 4,
    "failedChecks": 0
  }
}
```

### Degraded Response (207 - Multi-Status)

```json
{
  "status": "degraded",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "pass",
      "message": "Database connection successful"
    },
    "encryptionKeys": {
      "status": "warning",
      "message": "Active encryption key expires soon",
      "details": {
        "keyVersion": 1,
        "algorithm": "aes-256-gcm",
        "expiresAt": "2024-01-20T10:30:00.000Z",
        "daysUntilExpiry": 5,
        "recommendation": "Consider rotating encryption keys"
      }
    },
    "activeConnections": {
      "status": "warning",
      "message": "Some connections have tokens expiring soon",
      "details": {
        "activeConnections": 5,
        "expiredConnections": 2,
        "expiringSoon": 2,
        "expiringSoonIds": ["uuid-1", "uuid-2"],
        "recommendation": "Token refresh will be triggered automatically"
      }
    },
    "tokenValidation": {
      "status": "pass",
      "message": "Token validation system operational"
    }
  },
  "summary": {
    "totalChecks": 4,
    "passedChecks": 2,
    "failedChecks": 2
  },
  "recommendations": [
    "Consider rotating encryption keys",
    "Token refresh will be triggered automatically"
  ]
}
```

### Unhealthy Response (503 - Service Unavailable)

```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "fail",
      "message": "Database connection failed",
      "error": "Connection timeout",
      "details": {
        "errorCode": "ETIMEDOUT",
        "errorHint": "Check database connectivity"
      }
    },
    "encryptionKeys": {
      "status": "fail",
      "message": "No active encryption keys found",
      "details": {
        "recommendation": "Run encryption key initialization script"
      }
    },
    "activeConnections": {
      "status": "pass",
      "message": "Active connections healthy"
    },
    "tokenValidation": {
      "status": "fail",
      "message": "Token encryption/decryption test failed",
      "error": "Encryption key not found",
      "details": {
        "recommendation": "Check encryption keys configuration"
      }
    }
  },
  "summary": {
    "totalChecks": 4,
    "passedChecks": 1,
    "failedChecks": 3
  },
  "recommendations": [
    "Run encryption key initialization script",
    "Check encryption keys configuration"
  ]
}
```

## Health Checks Performed

### 1. Database Connectivity

**What it checks:**
- Database connection is established
- Can query `google_ads_connections` table
- Database responds to queries

**Possible statuses:**
- `pass`: Database connection successful
- `fail`: Cannot connect to database or query failed

### 2. Encryption Keys

**What it checks:**
- `google_ads_encryption_keys` table exists
- At least one active encryption key exists
- Encryption key has not expired
- Encryption key expiration date

**Possible statuses:**
- `pass`: Active encryption keys properly configured
- `warning`: Encryption key expires in less than 7 days
- `fail`: No active keys found or key has expired

**Recommendations:**
- Rotate encryption keys if expiring soon
- Initialize encryption keys if none exist

### 3. Active Connections

**What it checks:**
- Number of active Google Ads connections
- Number of expired connections
- Token expiration times for active connections
- Connections with tokens expiring soon (< 10 minutes)

**Possible statuses:**
- `pass`: Active connections healthy
- `warning`: No active connections or tokens expiring soon
- `fail`: Cannot query connections table

**Recommendations:**
- Users need to connect Google Ads accounts if none active
- Token refresh will be triggered automatically for expiring tokens

### 4. Token Validation

**What it checks:**
- Token encryption/decryption functionality
- Crypto service operational
- Connections needing token refresh

**Possible statuses:**
- `pass`: Token validation system operational
- `warning`: Some connections need token refresh
- `fail`: Encryption test failed or crypto service error

**Recommendations:**
- Check encryption keys configuration if test fails
- Token refresh will be triggered on next API call

## HTTP Status Codes

| Status Code | Meaning | Description |
|------------|---------|-------------|
| 200 | Healthy | All checks passed |
| 207 | Degraded | Some checks have warnings but system is operational |
| 503 | Unhealthy | One or more critical checks failed |
| 500 | Error | Health check itself failed to execute |

## Usage Examples

### cURL

```bash
# Basic health check
curl http://localhost:3000/api/google/health

# With pretty printing
curl http://localhost:3000/api/google/health | jq
```

### JavaScript/TypeScript

```typescript
async function checkGoogleAdsHealth() {
  try {
    const response = await fetch('/api/google/health');
    const health = await response.json();
    
    console.log('System status:', health.status);
    console.log('Passed checks:', health.summary.passedChecks);
    console.log('Failed checks:', health.summary.failedChecks);
    
    if (health.recommendations) {
      console.log('Recommendations:', health.recommendations);
    }
    
    return health;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
}
```

### Monitoring Integration

```typescript
// Example: Integrate with monitoring system
async function monitorGoogleAdsHealth() {
  const health = await fetch('/api/google/health').then(r => r.json());
  
  // Send to monitoring service
  if (health.status === 'unhealthy') {
    await sendAlert({
      severity: 'critical',
      message: 'Google Ads integration is unhealthy',
      details: health.checks,
      recommendations: health.recommendations,
    });
  } else if (health.status === 'degraded') {
    await sendAlert({
      severity: 'warning',
      message: 'Google Ads integration is degraded',
      details: health.checks,
      recommendations: health.recommendations,
    });
  }
}
```

## Troubleshooting

### Database Connection Failed

**Symptoms:**
- `database` check status is `fail`
- Error message: "Database connection failed"

**Solutions:**
1. Check Supabase connection settings in `.env`
2. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Check network connectivity to Supabase
4. Verify database is not paused (Supabase free tier)

### No Active Encryption Keys

**Symptoms:**
- `encryptionKeys` check status is `fail`
- Error message: "No active encryption keys found"

**Solutions:**
1. Run encryption key initialization:
   ```bash
   node scripts/apply-google-encryption-migration.js
   ```
2. Verify migration was applied:
   ```sql
   SELECT * FROM google_ads_encryption_keys WHERE is_active = true;
   ```

### Encryption Key Expires Soon

**Symptoms:**
- `encryptionKeys` check status is `warning`
- Message: "Active encryption key expires soon"

**Solutions:**
1. Plan key rotation before expiration
2. Generate new encryption key
3. Update active key in database

### Token Validation Failed

**Symptoms:**
- `tokenValidation` check status is `fail`
- Error message: "Token encryption/decryption test failed"

**Solutions:**
1. Check encryption keys are properly configured
2. Verify crypto service initialization
3. Check logs for detailed error messages
4. Run encryption test script:
   ```bash
   node scripts/test-google-encryption.js
   ```

### No Active Connections

**Symptoms:**
- `activeConnections` check status is `warning`
- Message: "No active Google Ads connections found"

**Solutions:**
1. Users need to connect their Google Ads accounts
2. Navigate to Google Ads integration page
3. Complete OAuth flow to connect account

## Integration with CI/CD

### Health Check in Deployment Pipeline

```yaml
# Example: GitHub Actions
- name: Health Check
  run: |
    # Wait for deployment
    sleep 30
    
    # Check health
    HEALTH_STATUS=$(curl -s https://your-app.com/api/google/health | jq -r '.status')
    
    if [ "$HEALTH_STATUS" != "healthy" ]; then
      echo "Health check failed: $HEALTH_STATUS"
      exit 1
    fi
    
    echo "Health check passed"
```

### Scheduled Health Monitoring

```typescript
// Example: Vercel Cron Job
// api/cron/health-check.ts
export async function GET() {
  const health = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google/health`)
    .then(r => r.json());
  
  if (health.status !== 'healthy') {
    // Send notification
    await sendSlackNotification({
      channel: '#alerts',
      message: `Google Ads health check: ${health.status}`,
      details: health.recommendations,
    });
  }
  
  return Response.json({ checked: true, status: health.status });
}
```

## Related Documentation

- [Google Ads Schema Fix](../GOOGLE_ADS_INDEX.md)
- [Token Management](./GOOGLE_TOKEN_LOGGING_GUIDE.md)
- [Encryption Keys Migration](../database/migrations/001-fix-google-ads-encryption-keys.sql)
- [RLS Policies](../GOOGLE_ADS_RLS_POLICIES_COMPLETE.md)

## Requirements Satisfied

This health check endpoint satisfies the following requirements:

- **Requirement 2.1**: Enhance token validation with health check endpoint
- **Requirement 9.1**: Provide endpoint that checks connection status
- **Requirement 9.2**: Validate database schema integrity
- **Requirement 9.3**: Check if encryption keys are properly configured
- **Requirement 9.4**: Verify that at least one active connection exists
- **Requirement 9.5**: Return detailed status report
