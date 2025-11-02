# Google Ads Database Schema Reference

## Overview

This document provides a comprehensive reference for the Google Ads integration database schema.

## Tables

### google_ads_connections

Stores OAuth connections to Google Ads accounts with encrypted tokens.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `client_id` | UUID | Foreign key to clients table |
| `customer_id` | TEXT | Google Ads customer ID (10-digit) |
| `refresh_token` | TEXT | Encrypted OAuth refresh token |
| `access_token` | TEXT | Encrypted OAuth access token |
| `token_expires_at` | TIMESTAMPTZ | Token expiration timestamp |
| `last_sync_at` | TIMESTAMPTZ | Last successful sync timestamp |
| `status` | TEXT | Connection status: 'active', 'expired', 'revoked' |
| `created_at` | TIMESTAMPTZ | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Constraints:**
- Unique: `(client_id, customer_id)`
- Foreign key: `client_id` → `clients(id)` ON DELETE CASCADE

**Indexes:**
- `idx_google_connections_client` on `client_id`
- `idx_google_connections_status` on `status`
- `idx_google_connections_customer` on `customer_id`

**RLS Policy:**
Users can only access connections for clients they have access to via `organization_memberships`.

---

### google_ads_campaigns

Stores Google Ads campaign data synced from the API.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `client_id` | UUID | Foreign key to clients table |
| `connection_id` | UUID | Foreign key to google_ads_connections |
| `campaign_id` | TEXT | Google Ads campaign ID |
| `campaign_name` | TEXT | Campaign name |
| `status` | TEXT | Campaign status: 'ENABLED', 'PAUSED', 'REMOVED' |
| `budget_amount` | DECIMAL(10,2) | Daily budget amount |
| `budget_currency` | TEXT | Currency code (default: 'USD') |
| `start_date` | DATE | Campaign start date |
| `end_date` | DATE | Campaign end date (nullable) |
| `created_at` | TIMESTAMPTZ | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Constraints:**
- Unique: `(connection_id, campaign_id)`
- Foreign key: `client_id` → `clients(id)` ON DELETE CASCADE
- Foreign key: `connection_id` → `google_ads_connections(id)` ON DELETE CASCADE

**Indexes:**
- `idx_google_campaigns_client` on `client_id`
- `idx_google_campaigns_connection` on `connection_id`
- `idx_google_campaigns_status` on `status`
- `idx_google_campaigns_campaign_id` on `campaign_id`

**RLS Policy:**
Users can only access campaigns for clients they have access to via `organization_memberships`.

---

### google_ads_metrics

Stores daily performance metrics for Google Ads campaigns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | Foreign key to google_ads_campaigns |
| `date` | DATE | Metric date |
| `impressions` | BIGINT | Number of impressions |
| `clicks` | BIGINT | Number of clicks |
| `conversions` | DECIMAL(10,2) | Number of conversions |
| `cost` | DECIMAL(10,2) | Total cost in account currency |
| `ctr` | DECIMAL(5,2) | Click-through rate (%) |
| `conversion_rate` | DECIMAL(5,2) | Conversion rate (%) |
| `cpc` | DECIMAL(10,2) | Cost per click |
| `cpa` | DECIMAL(10,2) | Cost per acquisition |
| `roas` | DECIMAL(10,2) | Return on ad spend |
| `created_at` | TIMESTAMPTZ | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Constraints:**
- Unique: `(campaign_id, date)`
- Foreign key: `campaign_id` → `google_ads_campaigns(id)` ON DELETE CASCADE

**Indexes:**
- `idx_google_metrics_campaign` on `campaign_id`
- `idx_google_metrics_date` on `date DESC`
- `idx_google_metrics_campaign_date` on `(campaign_id, date DESC)`

**RLS Policy:**
Users can only access metrics for campaigns belonging to clients they have access to.

---

### google_ads_sync_logs

Logs all synchronization attempts for monitoring and debugging.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `connection_id` | UUID | Foreign key to google_ads_connections |
| `sync_type` | TEXT | Sync type: 'full', 'incremental', 'metrics' |
| `status` | TEXT | Sync status: 'success', 'partial', 'failed' |
| `campaigns_synced` | INTEGER | Number of campaigns synced |
| `metrics_updated` | INTEGER | Number of metric records updated |
| `error_message` | TEXT | Error message if failed |
| `error_code` | TEXT | Error code for categorization |
| `started_at` | TIMESTAMPTZ | Sync start timestamp |
| `completed_at` | TIMESTAMPTZ | Sync completion timestamp |
| `created_at` | TIMESTAMPTZ | Record creation timestamp |

**Constraints:**
- Foreign key: `connection_id` → `google_ads_connections(id)` ON DELETE CASCADE

**Indexes:**
- `idx_google_sync_logs_connection` on `connection_id`
- `idx_google_sync_logs_status` on `status`
- `idx_google_sync_logs_created` on `created_at DESC`

**RLS Policy:**
Users can only access sync logs for connections belonging to clients they have access to.

---

## Functions

### get_active_google_connections(p_client_id UUID)

Returns active Google Ads connections for a specific client.

**Parameters:**
- `p_client_id`: UUID of the client

**Returns:**
```sql
TABLE (
  connection_id UUID,
  customer_id TEXT,
  last_sync_at TIMESTAMPTZ,
  status TEXT
)
```

**Example:**
```sql
SELECT * FROM get_active_google_connections('client-uuid-here');
```

---

### get_google_campaign_metrics_summary(p_campaign_id UUID, p_start_date DATE, p_end_date DATE)

Returns aggregated metrics for a campaign over a date range.

**Parameters:**
- `p_campaign_id`: UUID of the campaign
- `p_start_date`: Start date for aggregation
- `p_end_date`: End date for aggregation

**Returns:**
```sql
TABLE (
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_conversions DECIMAL,
  total_cost DECIMAL,
  avg_ctr DECIMAL,
  avg_conversion_rate DECIMAL,
  avg_cpc DECIMAL,
  avg_cpa DECIMAL,
  avg_roas DECIMAL
)
```

**Example:**
```sql
SELECT * FROM get_google_campaign_metrics_summary(
  'campaign-uuid-here',
  '2024-01-01',
  '2024-01-31'
);
```

---

## Triggers

### update_google_ads_updated_at

Automatically updates the `updated_at` column on UPDATE operations.

**Applied to:**
- `google_ads_connections`
- `google_ads_campaigns`
- `google_ads_metrics`

---

## Security

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:

1. **Client Isolation**: Users can only access data for clients they belong to
2. **Organization-based Access**: Access is determined via `organization_memberships` table
3. **Cascading Security**: Metrics inherit security from campaigns, campaigns from connections

### Token Encryption

- `refresh_token` and `access_token` in `google_ads_connections` should be encrypted before storage
- Encryption is handled at the application layer
- Never log or expose tokens in API responses

---

## Data Retention

### Recommended Policies

1. **Sync Logs**: Retain for 90 days
   ```sql
   DELETE FROM google_ads_sync_logs 
   WHERE created_at < NOW() - INTERVAL '90 days';
   ```

2. **Metrics**: Retain based on subscription plan
   - Free: 30 days
   - Pro: 90 days
   - Enterprise: Unlimited

3. **Campaigns**: Retain indefinitely (soft delete)

---

## Query Examples

### Get all active connections for a client
```sql
SELECT * FROM google_ads_connections
WHERE client_id = 'client-uuid'
  AND status = 'active';
```

### Get campaigns with recent metrics
```sql
SELECT 
  c.campaign_name,
  c.status,
  m.date,
  m.impressions,
  m.clicks,
  m.cost
FROM google_ads_campaigns c
LEFT JOIN google_ads_metrics m ON c.id = m.campaign_id
WHERE c.client_id = 'client-uuid'
  AND m.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY m.date DESC, c.campaign_name;
```

### Get sync history for a connection
```sql
SELECT 
  sync_type,
  status,
  campaigns_synced,
  metrics_updated,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
FROM google_ads_sync_logs
WHERE connection_id = 'connection-uuid'
ORDER BY started_at DESC
LIMIT 10;
```

### Get campaign performance summary
```sql
SELECT 
  c.campaign_name,
  COUNT(DISTINCT m.date) as days_active,
  SUM(m.impressions) as total_impressions,
  SUM(m.clicks) as total_clicks,
  SUM(m.conversions) as total_conversions,
  SUM(m.cost) as total_cost,
  AVG(m.ctr) as avg_ctr,
  AVG(m.roas) as avg_roas
FROM google_ads_campaigns c
LEFT JOIN google_ads_metrics m ON c.id = m.campaign_id
WHERE c.client_id = 'client-uuid'
  AND m.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.id, c.campaign_name
ORDER BY total_cost DESC;
```

---

## Maintenance

### Regular Tasks

1. **Clean old sync logs** (weekly)
2. **Vacuum tables** (monthly)
3. **Analyze query performance** (monthly)
4. **Review RLS policies** (quarterly)
5. **Audit token expiration** (daily via cron)

### Performance Monitoring

Monitor these metrics:
- Query execution time on metrics table
- Index usage statistics
- Table bloat
- Connection pool usage
- Sync duration trends

---

## Migration Notes

When applying this schema:

1. Ensure `clients` table exists
2. Ensure `organization_memberships` table exists
3. Run schema as superuser or with sufficient privileges
4. Verify RLS policies are active
5. Test with a non-admin user to confirm isolation

---

## Version History

- **v1.0.0** (2024-01-27): Initial schema creation
  - Created all four tables
  - Implemented RLS policies
  - Added helper functions
  - Created indexes for performance
