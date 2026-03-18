# Google Ads Token Expiration Logging Guide

## Overview

The Google Ads Token Manager now includes comprehensive logging for all token operations. This guide explains how to interpret the logs and use them for debugging.

## Log Format

All token manager logs follow this format:
```
[Token Manager] <message>: <structured data>
```

## Visual Indicators

- ✅ **Success**: Operation completed successfully
- ❌ **Failure**: Operation failed
- ⚠️ **Warning**: Attention needed (e.g., token expiring soon)
- `========================================`: Visual separator for major operations

## Token Expiration Check Logs

### Example Log
```javascript
[Token Manager] Token expiration check: {
  expiresAt: '2024-11-24T15:30:00.000Z',
  now: '2024-11-24T15:20:00.000Z',
  timeUntilExpiryMs: 600000,
  timeUntilExpiryMinutes: 10,
  bufferMinutes: 5,
  isExpired: false,
  willExpireSoon: false,
  alreadyExpired: false
}
```

### Fields Explained

- **expiresAt**: When the token will expire (ISO 8601 format)
- **now**: Current timestamp
- **timeUntilExpiryMs**: Milliseconds until token expires
- **timeUntilExpiryMinutes**: Minutes until token expires (rounded down)
- **bufferMinutes**: Refresh buffer time (default: 5 minutes)
- **isExpired**: `true` if token needs refresh (expired or within buffer)
- **willExpireSoon**: `true` if token will expire within buffer window
- **alreadyExpired**: `true` if token has already expired

### Interpreting the Status

| isExpired | willExpireSoon | alreadyExpired | Meaning |
|-----------|----------------|----------------|---------|
| false | false | false | Token is valid and not expiring soon |
| true | true | false | Token will expire soon, refresh recommended |
| true | false | true | Token has expired, refresh required |

## Token Refresh Logs

### Successful Refresh

```javascript
[Token Manager] ========================================
[Token Manager] Starting token refresh: {
  connectionId: 'abc-123',
  timestamp: '2024-11-24T15:25:00.000Z',
  hasRefreshToken: true,
  refreshTokenPrefix: '1//0gAAAa...'
}
[Token Manager] Calling Google OAuth API to refresh token...
[Token Manager] OAuth API response received: {
  hasAccessToken: true,
  hasRefreshToken: true,
  expiresIn: 3599,
  tokenType: 'Bearer'
}
[Token Manager] Saving new tokens to database...
[Token Manager] ✅ Token refresh completed successfully: {
  connectionId: 'abc-123',
  expiresAt: '2024-11-24T16:25:00.000Z',
  expiresInMinutes: 59,
  durationMs: 234,
  newAccessTokenPrefix: 'ya29.a0Af...'
}
[Token Manager] ========================================
```

### Failed Refresh

```javascript
[Token Manager] ❌ Token refresh failed: {
  connectionId: 'abc-123',
  error: 'invalid_grant: Token has been expired or revoked',
  errorType: 'Error',
  durationMs: 156,
  timestamp: '2024-11-24T15:25:00.000Z'
}
[Token Manager] Error stack trace: <stack trace>
[Token Manager] Marking connection as expired due to refresh failure...
[Token Manager] ✅ Connection marked as expired successfully: abc-123
[Token Manager] ========================================
```

## Ensure Valid Token Logs

### Token Still Valid

```javascript
[Token Manager] ========================================
[Token Manager] Ensuring valid token for connection: {
  connectionId: 'abc-123',
  timestamp: '2024-11-24T15:25:00.000Z'
}
[Token Manager] Fetching current tokens from database...
[Token Manager] Current token status: {
  hasAccessToken: true,
  hasRefreshToken: true,
  expiresAt: '2024-11-24T16:25:00.000Z',
  accessTokenPrefix: 'ya29.a0Af...'
}
[Token Manager] ✅ Token is still valid, no refresh needed: {
  connectionId: 'abc-123',
  expiresAt: '2024-11-24T16:25:00.000Z',
  timeUntilExpiryMs: 3600000,
  timeUntilExpiryMinutes: 60,
  timeUntilExpiryHours: 1
}
[Token Manager] ========================================
```

### Token Needs Refresh

```javascript
[Token Manager] ========================================
[Token Manager] Ensuring valid token for connection: {
  connectionId: 'abc-123',
  timestamp: '2024-11-24T15:25:00.000Z'
}
[Token Manager] Fetching current tokens from database...
[Token Manager] Current token status: {
  hasAccessToken: true,
  hasRefreshToken: true,
  expiresAt: '2024-11-24T15:28:00.000Z',
  accessTokenPrefix: 'ya29.a0Af...'
}
[Token Manager] ⚠️ Token expired or expiring soon, initiating refresh: {
  connectionId: 'abc-123',
  expiresAt: '2024-11-24T15:28:00.000Z',
  now: '2024-11-24T15:25:00.000Z',
  timeUntilExpiryMs: 180000,
  timeUntilExpiryMinutes: 3,
  alreadyExpired: false
}
[Token Manager] <refresh logs follow>
```

## Batch Refresh Logs

```javascript
[Token Manager] ========================================
[Token Manager] Starting batch token refresh: {
  totalConnections: 5,
  connectionIds: ['abc-123', 'def-456', 'ghi-789', 'jkl-012', 'mno-345'],
  timestamp: '2024-11-24T15:25:00.000Z'
}
[Token Manager] Processing connection 1/5: {
  connectionId: 'abc-123',
  progress: '0%'
}
[Token Manager] ✅ Connection 1/5 processed successfully: {
  connectionId: 'abc-123',
  durationMs: 234
}
[Token Manager] Processing connection 2/5: {
  connectionId: 'def-456',
  progress: '20%'
}
[Token Manager] ❌ Failed to refresh token for connection 2/5: {
  connectionId: 'def-456',
  error: 'invalid_grant',
  durationMs: 156
}
...
[Token Manager] Batch token refresh completed: {
  totalConnections: 5,
  successful: 4,
  failed: 1,
  successRate: '80%',
  totalDurationMs: 1234,
  averageDurationMs: 246,
  timestamp: '2024-11-24T15:26:00.000Z'
}
[Token Manager] ========================================
```

## Connections Needing Refresh Logs

```javascript
[Token Manager] Checking for connections needing token refresh: {
  now: '2024-11-24T15:25:00.000Z',
  bufferTime: '2024-11-24T15:35:00.000Z',
  bufferMinutes: 10
}
[Token Manager] Connections needing refresh: {
  totalFound: 3,
  connections: [
    {
      id: 'abc-123',
      customerId: '123-456-7890',
      clientId: 'client-1',
      expiresAt: '2024-11-24T15:30:00.000Z',
      minutesUntilExpiry: 5
    },
    {
      id: 'def-456',
      customerId: '234-567-8901',
      clientId: 'client-2',
      expiresAt: '2024-11-24T15:28:00.000Z',
      minutesUntilExpiry: 3
    },
    {
      id: 'ghi-789',
      customerId: '345-678-9012',
      clientId: 'client-3',
      expiresAt: '2024-11-24T15:20:00.000Z',
      minutesUntilExpiry: -5
    }
  ]
}
```

## Common Debugging Scenarios

### Scenario 1: Token Refresh Failing

**Symptoms**: Logs show `❌ Token refresh failed`

**Check**:
1. Look at the `error` field in the failure log
2. Common errors:
   - `invalid_grant`: Token has been revoked or expired
   - `invalid_client`: OAuth credentials are incorrect
   - Network errors: Check connectivity to Google OAuth API

**Solution**:
- For `invalid_grant`: User needs to reconnect their account
- For `invalid_client`: Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables
- For network errors: Check firewall/proxy settings

### Scenario 2: Token Not Refreshing When It Should

**Symptoms**: Token expires but no refresh attempt is logged

**Check**:
1. Look for "Token expiration check" logs
2. Verify `isExpired` is `true` when expected
3. Check `bufferMinutes` configuration

**Solution**:
- Ensure `ensureValidToken()` is called before API requests
- Verify token expiration time is set correctly in database
- Check if connection status is `active`

### Scenario 3: Frequent Token Refreshes

**Symptoms**: Token refresh logs appear too frequently

**Check**:
1. Look at `timeUntilExpiryMinutes` in expiration check logs
2. Check `bufferMinutes` setting (default: 5 minutes)
3. Verify `expiresIn` value from Google OAuth API

**Solution**:
- If `expiresIn` is too short, check Google OAuth configuration
- If buffer is too large, adjust `REFRESH_BUFFER_MINUTES`
- Consider caching valid tokens to reduce checks

### Scenario 4: Batch Refresh Low Success Rate

**Symptoms**: `successRate` is below 80% in batch refresh logs

**Check**:
1. Look at individual connection failure logs
2. Check if failures are consistent (same error) or varied
3. Review `minutesUntilExpiry` for failed connections

**Solution**:
- If consistent error: Fix root cause (credentials, permissions)
- If varied errors: Investigate per-connection issues
- If already expired: Increase batch refresh frequency

## Security Notes

### What's Logged (Safe)
- Token prefixes (first 10 characters)
- Token lengths
- Token presence (boolean)
- Expiration times
- Connection IDs
- Customer IDs

### What's NOT Logged (Secure)
- Full access tokens
- Full refresh tokens
- OAuth client secrets
- User passwords
- Sensitive user data

### Token Prefix Examples

Access tokens start with `ya29.`:
```
accessTokenPrefix: 'ya29.a0Af...'
```

Refresh tokens start with `1//`:
```
refreshTokenPrefix: '1//0gAAAa...'
```

## Performance Monitoring

### Key Metrics to Track

1. **Token Refresh Duration** (`durationMs`)
   - Normal: 100-500ms
   - Slow: 500-1000ms
   - Very slow: >1000ms

2. **Batch Refresh Success Rate** (`successRate`)
   - Good: >95%
   - Acceptable: 80-95%
   - Poor: <80%

3. **Time Until Expiry** (`timeUntilExpiryMinutes`)
   - Healthy: >10 minutes
   - Warning: 5-10 minutes
   - Critical: <5 minutes

## Integration with Monitoring Tools

### Log Aggregation

The structured JSON format makes it easy to parse logs with tools like:
- **Elasticsearch**: Index logs for searching
- **Splunk**: Create dashboards for token health
- **CloudWatch**: Set up alarms for failures
- **Datadog**: Track token refresh metrics

### Example Elasticsearch Query

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "message": "Token Manager" } },
        { "match": { "message": "Token refresh failed" } }
      ],
      "filter": [
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

### Example CloudWatch Alarm

Create an alarm when token refresh failures exceed threshold:
```
Metric: TokenRefreshFailures
Threshold: > 5 failures in 5 minutes
Action: Send SNS notification
```

## Troubleshooting Checklist

- [ ] Check if token expiration logs show correct times
- [ ] Verify refresh attempts are logged with all details
- [ ] Confirm no full token values appear in logs
- [ ] Check error messages include stack traces
- [ ] Verify audit trail is being created
- [ ] Confirm visual separators make logs readable
- [ ] Check batch operations show progress
- [ ] Verify timing information is accurate

## Related Documentation

- [Google Ads Schema Fix Spec](.kiro/specs/google-ads-schema-fix/design.md)
- [Token Manager Implementation](src/lib/google/token-manager.ts)
- [OAuth Service](src/lib/google/oauth.ts)
- [Audit Service](src/lib/google/audit-service.ts)

## Support

If you encounter issues with token logging:
1. Check this guide for common scenarios
2. Review the test suite for expected behavior
3. Check the task completion summary for implementation details
4. Contact the development team with specific log examples
