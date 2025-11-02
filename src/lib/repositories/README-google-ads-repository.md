# Google Ads Repository

Comprehensive data access layer for Google Ads integration, managing connections, campaigns, metrics, and sync logs.

## Overview

The `GoogleAdsRepository` provides a clean abstraction over Supabase database operations for Google Ads data. It handles:

- **Connections**: OAuth connections to Google Ads accounts
- **Campaigns**: Campaign data synced from Google Ads API
- **Metrics**: Daily performance metrics for campaigns
- **Sync Logs**: Audit trail of synchronization operations

## Features

- ✅ Complete CRUD operations for all Google Ads entities
- ✅ Batch operations for efficient data syncing
- ✅ Optimized queries with filters and pagination
- ✅ Historical metrics retrieval with date ranges
- ✅ Aggregated metrics using database functions
- ✅ Comprehensive error handling
- ✅ Type-safe interfaces for all operations

## Installation

```typescript
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';

const repository = new GoogleAdsRepository();
```

## Usage Examples

### Connection Management

#### Save a New Connection

```typescript
const connection = await repository.saveConnection({
  client_id: 'uuid-client-id',
  customer_id: '1234567890',
  refresh_token: 'encrypted-refresh-token',
  access_token: 'encrypted-access-token',
  token_expires_at: new Date(Date.now() + 3600000),
  last_sync_at: null,
  status: 'active',
});

console.log('Connection saved:', connection.id);
```

#### Get Active Connection

```typescript
const connection = await repository.getConnection('client-id');

if (connection) {
  console.log('Customer ID:', connection.customer_id);
  console.log('Last sync:', connection.last_sync_at);
}
```

#### Update Tokens

```typescript
await repository.updateTokens('connection-id', {
  access_token: 'new-encrypted-token',
  token_expires_at: new Date(Date.now() + 3600000),
});
```

#### Update Last Sync

```typescript
await repository.updateLastSync('connection-id');
```

### Campaign Management

#### Save Campaigns (Batch)

```typescript
const campaigns: GoogleAdsCampaign[] = [
  {
    id: '12345',
    name: 'Summer Sale 2024',
    status: 'ENABLED',
    budget: 1000,
    startDate: '2024-06-01',
    endDate: '2024-08-31',
    metrics: {
      impressions: 50000,
      clicks: 2500,
      conversions: 125,
      cost: 500,
      ctr: 5.0,
      conversionRate: 5.0,
      cpc: 0.20,
      cpa: 4.0,
      roas: 3.5,
    },
  },
  // ... more campaigns
];

const count = await repository.saveCampaigns(
  campaigns,
  'connection-id',
  'client-id'
);

console.log(`Saved ${count} campaigns`);
```

#### Get Campaigns with Filters

```typescript
const campaigns = await repository.getCampaigns('client-id', {
  status: 'ENABLED',
  searchTerm: 'summer',
  limit: 20,
  offset: 0,
});

campaigns.forEach(campaign => {
  console.log(`${campaign.campaign_name}: ${campaign.status}`);
});
```

#### Get Single Campaign

```typescript
const campaign = await repository.getCampaignById('campaign-uuid');

if (campaign) {
  console.log('Campaign:', campaign.campaign_name);
  console.log('Budget:', campaign.budget_amount);
}
```

#### Update Campaign Status

```typescript
await repository.updateCampaignStatus('campaign-uuid', 'PAUSED');
```

### Metrics Management

#### Save Single Day Metrics

```typescript
await repository.saveMetrics(
  'campaign-uuid',
  {
    impressions: 1000,
    clicks: 50,
    conversions: 5,
    cost: 25.50,
    ctr: 5.0,
    conversionRate: 10.0,
    cpc: 0.51,
    cpa: 5.10,
    roas: 2.5,
  },
  '2024-01-15'
);
```

#### Save Metrics in Batch

```typescript
const metricsData = [
  {
    campaignId: 'campaign-uuid-1',
    date: '2024-01-15',
    metrics: { /* ... */ },
  },
  {
    campaignId: 'campaign-uuid-2',
    date: '2024-01-15',
    metrics: { /* ... */ },
  },
  // ... more metrics
];

const count = await repository.saveMetricsBatch(metricsData);
console.log(`Saved ${count} metric records`);
```

#### Get Historical Metrics

```typescript
const metrics = await repository.getHistoricalMetrics(
  'campaign-uuid',
  {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  }
);

metrics.forEach(metric => {
  console.log(`${metric.date}: ${metric.impressions} impressions`);
});
```

#### Get Metrics for Multiple Campaigns

```typescript
const metricsMap = await repository.getMetricsForCampaigns(
  ['campaign-uuid-1', 'campaign-uuid-2'],
  {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  }
);

metricsMap.forEach((metrics, campaignId) => {
  console.log(`Campaign ${campaignId}: ${metrics.length} days of data`);
});
```

#### Get Aggregated Metrics

```typescript
const aggregated = await repository.getAggregatedMetrics(
  'campaign-uuid',
  {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  }
);

console.log('Total impressions:', aggregated.total_impressions);
console.log('Total cost:', aggregated.total_cost);
console.log('Average ROAS:', aggregated.avg_roas);
```

### Sync Log Management

#### Create Sync Log

```typescript
const logId = await repository.createSyncLog({
  connection_id: 'connection-uuid',
  sync_type: 'full',
  status: 'success',
  campaigns_synced: 25,
  metrics_updated: 750,
  error_message: null,
  error_code: null,
  started_at: new Date('2024-01-15T10:00:00Z'),
  completed_at: new Date('2024-01-15T10:05:00Z'),
});

console.log('Sync log created:', logId);
```

#### Update Sync Log

```typescript
await repository.updateSyncLog('log-uuid', {
  status: 'success',
  campaigns_synced: 30,
  metrics_updated: 900,
  completed_at: new Date(),
});
```

#### Get Recent Sync Logs

```typescript
const logs = await repository.getSyncLogs('connection-uuid', 10);

logs.forEach(log => {
  console.log(`${log.sync_type} sync: ${log.status}`);
  console.log(`  Campaigns: ${log.campaigns_synced}`);
  console.log(`  Metrics: ${log.metrics_updated}`);
});
```

#### Get Last Successful Sync

```typescript
const lastSync = await repository.getLastSuccessfulSync('connection-uuid');

if (lastSync) {
  console.log('Last successful sync:', lastSync.completed_at);
  console.log('Campaigns synced:', lastSync.campaigns_synced);
}
```

### Utility Methods

#### Check Connection Existence

```typescript
const hasConnection = await repository.hasConnection('client-id');

if (hasConnection) {
  console.log('Client has an active Google Ads connection');
}
```

#### Get Campaign Count

```typescript
const totalCampaigns = await repository.getCampaignCount('client-id');
const activeCampaigns = await repository.getCampaignCount('client-id', 'ENABLED');

console.log(`Total: ${totalCampaigns}, Active: ${activeCampaigns}`);
```

## Data Types

### GoogleAdsConnection

```typescript
interface GoogleAdsConnection {
  id: string;
  client_id: string;
  customer_id: string;
  refresh_token: string; // encrypted
  access_token: string | null; // encrypted
  token_expires_at: Date | null;
  last_sync_at: Date | null;
  status: 'active' | 'expired' | 'revoked';
  created_at: Date;
  updated_at: Date;
}
```

### GoogleAdsCampaignRecord

```typescript
interface GoogleAdsCampaignRecord {
  id: string;
  client_id: string;
  connection_id: string;
  campaign_id: string;
  campaign_name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  budget_amount: number | null;
  budget_currency: string;
  start_date: string | null;
  end_date: string | null;
  created_at: Date;
  updated_at: Date;
}
```

### GoogleAdsMetricRecord

```typescript
interface GoogleAdsMetricRecord {
  id: string;
  campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number | null;
  conversion_rate: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  created_at: Date;
  updated_at: Date;
}
```

### GoogleAdsSyncLog

```typescript
interface GoogleAdsSyncLog {
  id: string;
  connection_id: string;
  sync_type: 'full' | 'incremental' | 'metrics';
  status: 'success' | 'partial' | 'failed';
  campaigns_synced: number;
  metrics_updated: number;
  error_message: string | null;
  error_code: string | null;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
}
```

## Error Handling

All methods throw descriptive errors that can be caught and handled:

```typescript
try {
  const connection = await repository.getConnection('client-id');
} catch (error) {
  console.error('Failed to get connection:', error.message);
  // Handle error appropriately
}
```

## Performance Considerations

### Batch Operations

Use batch methods for bulk operations:

```typescript
// ✅ Good: Batch insert
await repository.saveCampaigns(campaigns, connectionId, clientId);

// ❌ Bad: Individual inserts
for (const campaign of campaigns) {
  await repository.saveCampaigns([campaign], connectionId, clientId);
}
```

### Pagination

Always use pagination for large datasets:

```typescript
const campaigns = await repository.getCampaigns('client-id', {
  limit: 50,
  offset: 0,
});
```

### Aggregated Queries

Use database functions for aggregations:

```typescript
// ✅ Good: Database aggregation
const aggregated = await repository.getAggregatedMetrics(campaignId, dateRange);

// ❌ Bad: Client-side aggregation
const metrics = await repository.getHistoricalMetrics(campaignId, dateRange);
const total = metrics.reduce((sum, m) => sum + m.cost, 0);
```

## Database Schema

The repository works with these tables:

- `google_ads_connections` - OAuth connections
- `google_ads_campaigns` - Campaign data
- `google_ads_metrics` - Daily metrics
- `google_ads_sync_logs` - Sync audit logs

All tables have RLS (Row Level Security) policies that filter by client_id through organization_memberships.

## Integration with Other Services

### With Google Ads Client

```typescript
import { GoogleAdsClient } from '@/lib/google/client';
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';

const client = new GoogleAdsClient(config);
const repository = new GoogleAdsRepository();

// Fetch from API
const campaigns = await client.getCampaigns();

// Save to database
await repository.saveCampaigns(campaigns, connectionId, clientId);
```

### With Token Manager

```typescript
import { GoogleTokenManager } from '@/lib/google/token-manager';
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';

const tokenManager = new GoogleTokenManager();
const repository = new GoogleAdsRepository();

// Get connection
const connection = await repository.getConnection(clientId);

// Ensure valid token
const validToken = await tokenManager.ensureValidToken(connection.id);

// Update if refreshed
if (validToken !== connection.access_token) {
  await repository.updateTokens(connection.id, {
    access_token: validToken,
    token_expires_at: new Date(Date.now() + 3600000),
  });
}
```

## Testing

Example test structure:

```typescript
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';

describe('GoogleAdsRepository', () => {
  let repository: GoogleAdsRepository;

  beforeEach(() => {
    repository = new GoogleAdsRepository();
  });

  it('should save and retrieve connection', async () => {
    const connection = await repository.saveConnection({
      client_id: 'test-client',
      customer_id: '1234567890',
      refresh_token: 'encrypted-token',
      access_token: null,
      token_expires_at: null,
      last_sync_at: null,
      status: 'active',
    });

    expect(connection.id).toBeDefined();
    expect(connection.customer_id).toBe('1234567890');

    const retrieved = await repository.getConnection('test-client');
    expect(retrieved?.id).toBe(connection.id);
  });

  // ... more tests
});
```

## Requirements Satisfied

This repository implementation satisfies the following requirements:

- **2.1**: Implements RLS-compliant data access for Google Ads connections
- **2.2**: Provides CRUD operations for campaigns with client isolation
- **9.1**: Implements optimized queries with filters and pagination
- **9.2**: Provides historical metrics retrieval with date range support

## Related Documentation

- [Google Ads Client](../google/client.ts) - API client for Google Ads
- [Token Manager](../google/token-manager.ts) - Token encryption and refresh
- [Database Schema](../../../database/google-ads-schema.sql) - Database structure
