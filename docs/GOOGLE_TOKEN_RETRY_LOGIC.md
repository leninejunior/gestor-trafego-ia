# Google Ads Token Refresh Retry Logic

## Overview

The Google Ads token manager implements automatic retry logic with exponential backoff for token refresh failures. This improves reliability and reduces false positives for connection expiration.

## Configuration

### Retry Parameters

```typescript
MAX_RETRY_ATTEMPTS = 3        // Maximum number of retry attempts
INITIAL_RETRY_DELAY_MS = 1000 // Initial delay: 1 second
MAX_RETRY_DELAY_MS = 10000    // Maximum delay: 10 seconds
```

### Exponential Backoff Formula

```
delay = min(INITIAL_RETRY_DELAY_MS * 2^attemptNumber, MAX_RETRY_DELAY_MS)
jitter = delay * 0.2 * (Math.random() * 2 - 1)  // ±20% variation
finalDelay = delay + jitter
```

## Retry Schedule

| Attempt | Base Delay | Delay Range (with jitter) |
|---------|------------|---------------------------|
| 1       | Immediate  | 0ms                       |
| 2       | 1000ms     | 800ms - 1200ms           |
| 3       | 2000ms     | 1600ms - 2400ms          |

Total maximum time: ~3.6 seconds (with jitter)

## How It Works

### 1. Token Refresh Request

When `refreshAccessToken()` is called:

```typescript
const result = await tokenManager.refreshAccessToken(
  connectionId,
  refreshToken
);
```

### 2. Retry Loop

The method attempts to refresh the token up to `MAX_RETRY_ATTEMPTS` times:

1. **Attempt 1**: Immediate attempt
2. **Attempt 2**: After ~1 second delay (if attempt 1 fails)
3. **Attempt 3**: After ~2 second delay (if attempt 2 fails)

### 3. Success Handling

On successful refresh:
- Returns new access token
- Updates token expiration in database
- Logs success with retry count
- Records audit trail

### 4. Failure Handling

After all retries fail:
- Marks connection as `expired`
- Logs final failure with all attempt details
- Returns error from last attempt
- Records audit trail

## Logging

### Successful Refresh (with retry)

```
[Token Manager] Starting token refresh with retry logic
[Token Manager] Refresh attempt 1/3
[Token Manager] ❌ Token refresh attempt 1/3 failed
[Token Manager] ⏳ Waiting before retry: { retryDelayMs: 1200 }
[Token Manager] Refresh attempt 2/3
[Token Manager] ✅ Token refresh completed successfully
```

### Failed Refresh (all retries exhausted)

```
[Token Manager] Starting token refresh with retry logic
[Token Manager] Refresh attempt 1/3
[Token Manager] ❌ Token refresh attempt 1/3 failed
[Token Manager] ⏳ Waiting before retry
[Token Manager] Refresh attempt 2/3
[Token Manager] ❌ Token refresh attempt 2/3 failed
[Token Manager] ⏳ Waiting before retry
[Token Manager] Refresh attempt 3/3
[Token Manager] ❌ Token refresh attempt 3/3 failed
[Token Manager] ❌ Token refresh failed after all retry attempts
[Token Manager] Marking connection as expired
```

## Audit Trail

Each retry operation is logged to the audit system:

### Successful Refresh
```json
{
  "operation": "token_refresh",
  "success": true,
  "metadata": {
    "attemptNumber": 2,
    "retriesUsed": 1,
    "totalDurationMs": 1250,
    "status": "success"
  }
}
```

### Retry Attempt
```json
{
  "operation": "token_refresh",
  "success": false,
  "errorMessage": "Network timeout",
  "metadata": {
    "attemptNumber": 1,
    "maxAttempts": 3,
    "willRetry": true,
    "status": "retry"
  }
}
```

### Final Failure
```json
{
  "operation": "token_refresh",
  "success": false,
  "errorMessage": "Invalid refresh token",
  "metadata": {
    "totalAttempts": 3,
    "allRetriesExhausted": true,
    "status": "failed"
  }
}
```

## Error Types

### Transient Errors (Retryable)
- Network timeouts
- Temporary service unavailability
- Rate limiting (429 errors)
- Server errors (5xx)

### Permanent Errors (Not Retryable)
- Invalid refresh token (400)
- Revoked token (401)
- Insufficient permissions (403)

**Note**: The current implementation retries all errors. Future enhancements could skip retries for permanent errors.

## Benefits

### 1. Improved Reliability
- Handles transient network failures automatically
- Reduces false positives for connection expiration
- Increases overall success rate

### 2. Better User Experience
- Fewer unnecessary re-authentication prompts
- More stable connections
- Reduced service interruptions

### 3. Operational Visibility
- Detailed logs for troubleshooting
- Audit trail for compliance
- Metrics for monitoring

### 4. Scalability
- Exponential backoff prevents server overload
- Jitter prevents thundering herd
- Configurable parameters for tuning

## Monitoring

### Key Metrics to Track

1. **Retry Rate**: Percentage of refreshes requiring retries
2. **Success Rate by Attempt**: Success rate for each attempt number
3. **Average Retry Count**: Average number of retries per refresh
4. **Failure Rate**: Percentage of refreshes failing after all retries

### Example Queries

```sql
-- Retry rate
SELECT 
  COUNT(*) FILTER (WHERE metadata->>'retriesUsed' > '0') * 100.0 / COUNT(*) as retry_rate
FROM google_ads_audit_log
WHERE operation = 'token_refresh'
  AND success = true
  AND created_at > NOW() - INTERVAL '24 hours';

-- Failure rate
SELECT 
  COUNT(*) FILTER (WHERE NOT success) * 100.0 / COUNT(*) as failure_rate
FROM google_ads_audit_log
WHERE operation = 'token_refresh'
  AND metadata->>'status' = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours';
```

## Troubleshooting

### High Retry Rate

If retry rate is consistently high (>20%):
1. Check network connectivity
2. Verify Google OAuth service status
3. Review error types in audit logs
4. Consider increasing initial delay

### High Failure Rate

If failure rate is high (>5%):
1. Check for invalid refresh tokens
2. Verify OAuth credentials
3. Review Google API quotas
4. Check for revoked permissions

### Long Refresh Times

If refresh operations take too long:
1. Review retry delays
2. Check network latency
3. Consider reducing MAX_RETRY_ATTEMPTS
4. Optimize database queries

## Future Enhancements

1. **Circuit Breaker Pattern**: Stop retrying after persistent failures
2. **Smart Retry Logic**: Skip retries for permanent errors (400, 401, 403)
3. **Adaptive Delays**: Adjust delays based on error type
4. **Retry Budget**: Limit total retry time across all connections
5. **Metrics Dashboard**: Real-time monitoring of retry patterns

## Related Documentation

- [Token Manager](../src/lib/google/token-manager.ts)
- [OAuth Service](../src/lib/google/oauth.ts)
- [Audit Service](../src/lib/google/audit-service.ts)
- [Google Ads Health Check](./GOOGLE_ADS_HEALTH_CHECK.md)
- [Token Expiration Logging](./GOOGLE_TOKEN_LOGGING_GUIDE.md)

## References

- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Retry Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/retry)
