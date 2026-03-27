# Quick Start Guide - Multi-Platform Sync Engine

## Setup

### 1. Environment Variables

Add to your `.env` file:

```env
# Cron job authentication
CRON_SECRET=your-secure-random-string

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_CLIENT_ID=your-client-id
GOOGLE_ADS_CLIENT_SECRET=your-client-secret

# Meta Ads API (when implemented)
META_APP_ID=your-app-id
META_APP_SECRET=your-app-secret
```

### 2. Database Schema

Ensure these tables exist (should be created by `database/historical-data-cache-schema.sql`):

- `sync_configurations` - Stores OAuth tokens and sync settings
- `sync_logs` - Tracks sync execution history
- `campaign_insights_history` - Stores cached campaign data

### 3. plataforma de deploy Cron Jobs

The cron jobs are automatically configured in `deploy.json`:

- **Sync Scheduler**: Every 5 minutes
- **Sync Executor**: Every minute
- **Data Cleanup**: Daily at 3 AM

## Usage

### Add a Sync Configuration

```typescript
import { createClient } from '@/lib/supabase/server';
import { AdPlatform } from '@/lib/types/sync';

const supabase = await createClient();

// Add Google Ads sync configuration
await supabase.from('sync_configurations').insert({
  client_id: 'your-client-uuid',
  platform: AdPlatform.GOOGLE,
  account_id: '123-456-7890',
  access_token: 'ya29.a0...',
  refresh_token: '1//0g...',
  token_expires_at: new Date(Date.now() + 3600000),
  sync_status: 'active',
  next_sync_at: new Date() // Sync immediately
});
```

### Manual Sync

```typescript
import { multiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';
import { AdPlatform } from '@/lib/types/sync';

// Sync a specific client
const result = await multiPlatformSyncEngine.syncClient(
  'client-uuid',
  AdPlatform.GOOGLE
);

console.log(`Success: ${result.success}`);
console.log(`Records synced: ${result.records_synced}`);
console.log(`Duration: ${result.duration_ms}ms`);
```

### Check Queue Status

```bash
curl -X POST https://your-app.seu-dominio.com/api/cron/sync-executor \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}'
```

Response:
```json
{
  "success": true,
  "is_running": true,
  "is_empty": false,
  "stats": {
    "total_jobs": 10,
    "pending_jobs": 3,
    "running_jobs": 2,
    "failed_jobs": 1,
    "completed_jobs": 4,
    "average_duration_ms": 5234
  },
  "failed_jobs": [
    {
      "client_id": "uuid",
      "platform": "google",
      "attempts": 3,
      "last_error": "Rate limit exceeded",
      "last_attempt_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Retry Failed Jobs

```bash
curl -X POST https://your-app.seu-dominio.com/api/cron/sync-executor \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "retry_failed"}'
```

### Manual Data Cleanup

```bash
# Cleanup specific client
curl -X POST https://your-app.seu-dominio.com/api/cron/data-cleanup \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client-uuid",
    "retention_days": 90
  }'
```

## Monitoring

### View Sync Logs

```sql
-- Recent syncs
SELECT 
  sc.client_id,
  c.name as client_name,
  sc.platform,
  sl.status,
  sl.records_synced,
  sl.duration_ms,
  sl.error_message,
  sl.started_at,
  sl.completed_at
FROM sync_logs sl
JOIN sync_configurations sc ON sc.id = sl.sync_config_id
JOIN clients c ON c.id = sc.client_id
WHERE sl.started_at > NOW() - INTERVAL '24 hours'
ORDER BY sl.started_at DESC
LIMIT 50;

-- Failed syncs
SELECT 
  sc.client_id,
  sc.platform,
  COUNT(*) as failure_count,
  MAX(sl.started_at) as last_failure,
  sl.error_message
FROM sync_logs sl
JOIN sync_configurations sc ON sc.id = sl.sync_config_id
WHERE sl.status = 'failed'
  AND sl.started_at > NOW() - INTERVAL '7 days'
GROUP BY sc.client_id, sc.platform, sl.error_message
ORDER BY failure_count DESC;

-- Sync performance by platform
SELECT 
  sc.platform,
  COUNT(*) as total_syncs,
  AVG(sl.duration_ms) as avg_duration_ms,
  AVG(sl.records_synced) as avg_records,
  SUM(CASE WHEN sl.status = 'success' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN sl.status = 'failed' THEN 1 ELSE 0 END) as failed
FROM sync_logs sl
JOIN sync_configurations sc ON sc.id = sl.sync_config_id
WHERE sl.started_at > NOW() - INTERVAL '7 days'
GROUP BY sc.platform;
```

### Check Sync Configuration Status

```sql
-- Active configurations
SELECT 
  c.name as client_name,
  sc.platform,
  sc.sync_status,
  sc.last_sync_at,
  sc.next_sync_at,
  sc.last_error,
  CASE 
    WHEN sc.next_sync_at < NOW() THEN 'OVERDUE'
    WHEN sc.next_sync_at < NOW() + INTERVAL '1 hour' THEN 'DUE SOON'
    ELSE 'SCHEDULED'
  END as sync_state
FROM sync_configurations sc
JOIN clients c ON c.id = sc.client_id
WHERE sc.sync_status = 'active'
ORDER BY sc.next_sync_at;

-- Configurations with errors
SELECT 
  c.name as client_name,
  sc.platform,
  sc.last_error,
  sc.last_sync_at,
  sc.updated_at
FROM sync_configurations sc
JOIN clients c ON c.id = sc.client_id
WHERE sc.sync_status = 'error'
ORDER BY sc.updated_at DESC;
```

## Troubleshooting

### Sync Not Running

1. Check if cron jobs are configured in plataforma de deploy dashboard
2. Verify `CRON_SECRET` is set in environment variables
3. Check sync configuration status:
   ```sql
   SELECT * FROM sync_configurations WHERE client_id = 'your-client-id';
   ```

### Authentication Errors

1. Check if tokens are expired:
   ```sql
   SELECT 
     client_id,
     platform,
     token_expires_at,
     token_expires_at < NOW() as is_expired
   FROM sync_configurations
   WHERE sync_status = 'error';
   ```

2. Manually refresh tokens through OAuth flow
3. Update sync configuration with new tokens

### Rate Limiting

The system automatically handles rate limiting with exponential backoff. Check logs:

```sql
SELECT * FROM sync_logs 
WHERE error_message LIKE '%rate limit%'
ORDER BY started_at DESC;
```

### High Failure Rate

1. Check platform API status
2. Verify API credentials are valid
3. Check if account permissions are correct
4. Review error messages in `sync_logs`

### Queue Stuck

```bash
# Check queue status
curl -X POST https://your-app.seu-dominio.com/api/cron/sync-executor \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}'

# Stop and clear queue if needed
curl -X POST https://your-app.seu-dominio.com/api/cron/sync-executor \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'

curl -X POST https://your-app.seu-dominio.com/api/cron/sync-executor \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "clear"}'
```

## Best Practices

### 1. Plan Limits Configuration

Set appropriate sync intervals based on plan tier:

```sql
-- Free tier: sync every 24 hours
UPDATE plan_limits 
SET sync_interval_hours = 24 
WHERE plan_id = 'free-plan-id';

-- Pro tier: sync every 6 hours
UPDATE plan_limits 
SET sync_interval_hours = 6 
WHERE plan_id = 'pro-plan-id';

-- Enterprise: sync every hour
UPDATE plan_limits 
SET sync_interval_hours = 1 
WHERE plan_id = 'enterprise-plan-id';
```

### 2. Data Retention

Configure retention based on plan:

```sql
-- Free: 30 days
UPDATE plan_limits 
SET data_retention_days = 30 
WHERE plan_id = 'free-plan-id';

-- Pro: 90 days
UPDATE plan_limits 
SET data_retention_days = 90 
WHERE plan_id = 'pro-plan-id';

-- Enterprise: 365 days
UPDATE plan_limits 
SET data_retention_days = 365 
WHERE plan_id = 'enterprise-plan-id';
```

### 3. Monitoring Alerts

Set up alerts for:
- Failed syncs > 3 consecutive times
- Queue size > 50 jobs
- Average sync duration > 30 seconds
- Token expiration within 24 hours

### 4. Performance Optimization

- Keep sync intervals reasonable (not less than 1 hour for most cases)
- Monitor API quota usage
- Use incremental sync when possible
- Clean up old data regularly

## Support

For issues or questions:
1. Check the comprehensive documentation: `README-multi-platform-sync.md`
2. Review sync logs in database
3. Check plataforma de deploy function logs
4. Contact development team

