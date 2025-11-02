# Quick Start: Google Ads Repository

Get started with the Google Ads Repository in 5 minutes.

## Installation

```typescript
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';
```

## Basic Usage

### 1. Initialize Repository

```typescript
const repository = new GoogleAdsRepository();
```

### 2. Save a Connection

```typescript
// After OAuth flow completes
const connection = await repository.saveConnection({
  client_id: clientId,
  customer_id: googleCustomerId,
  refresh_token: encryptedRefreshToken,
  access_token: encryptedAccessToken,
  token_expires_at: new Date(Date.now() + 3600000),
  last_sync_at: null,
  status: 'active',
});
```

### 3. Sync Campaigns

```typescript
// Fetch campaigns from Google Ads API
const campaigns = await googleAdsClient.getCampaigns();

// Save to database
const count = await repository.saveCampaigns(
  campaigns,
  connection.id,
  clientId
);

console.log(`Synced ${count} campaigns`);
```

### 4. Save Metrics

```typescript
// For each campaign, save daily metrics
for (const campaign of campaigns) {
  await repository.saveMetrics(
    campaign.id,
    campaign.metrics,
    '2024-01-15'
  );
}
```

### 5. Retrieve Data

```typescript
// Get campaigns
const campaigns = await repository.getCampaigns(clientId, {
  status: 'ENABLED',
  limit: 20,
});

// Get metrics
const metrics = await repository.getHistoricalMetrics(
  campaignId,
  {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  }
);

// Get aggregated metrics
const aggregated = await repository.getAggregatedMetrics(
  campaignId,
  {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  }
);
```

## Common Patterns

### Pattern 1: Full Sync Flow

```typescript
async function performFullSync(clientId: string, connectionId: string) {
  const repository = new GoogleAdsRepository();
  
  // Create sync log
  const logId = await repository.createSyncLog({
    connection_id: connectionId,
    sync_type: 'full',
    status: 'success',
    campaigns_synced: 0,
    metrics_updated: 0,
    error_message: null,
    error_code: null,
    started_at: new Date(),
    completed_at: null,
  });

  try {
    // Fetch and save campaigns
    const campaigns = await googleAdsClient.getCampaigns();
    const campaignCount = await repository.saveCampaigns(
      campaigns,
      connectionId,
      clientId
    );

    // Fetch and save metrics
    let metricsCount = 0;
    for (const campaign of campaigns) {
      const metrics = await googleAdsClient.getCampaignMetrics(
        campaign.id,
        { startDate: '2024-01-01', endDate: '2024-01-31' }
      );
      await repository.saveMetrics(campaign.id, metrics, '2024-01-15');
      metricsCount++;
    }

    // Update sync log
    await repository.updateSyncLog(logId, {
      status: 'success',
      campaigns_synced: campaignCount,
      metrics_updated: metricsCount,
      completed_at: new Date(),
    });

    // Update last sync timestamp
    await repository.updateLastSync(connectionId);

    return { success: true, campaigns: campaignCount, metrics: metricsCount };
  } catch (error) {
    // Update sync log with error
    await repository.updateSyncLog(logId, {
      status: 'failed',
      error_message: error.message,
      completed_at: new Date(),
    });

    throw error;
  }
}
```

### Pattern 2: Check and Refresh Connection

```typescript
async function ensureActiveConnection(clientId: string) {
  const repository = new GoogleAdsRepository();
  
  // Check if connection exists
  const hasConnection = await repository.hasConnection(clientId);
  
  if (!hasConnection) {
    throw new Error('No active Google Ads connection found');
  }

  // Get connection
  const connection = await repository.getConnection(clientId);
  
  // Check if token needs refresh
  if (connection.token_expires_at && 
      connection.token_expires_at < new Date(Date.now() + 5 * 60 * 1000)) {
    // Token expires in less than 5 minutes, refresh it
    const tokenManager = new GoogleTokenManager();
    const newTokens = await tokenManager.refreshToken(connection.refresh_token);
    
    await repository.updateTokens(connection.id, {
      access_token: newTokens.access_token,
      token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
    });
  }

  return connection;
}
```

### Pattern 3: Dashboard Data Retrieval

```typescript
async function getDashboardData(clientId: string) {
  const repository = new GoogleAdsRepository();
  
  // Get active campaigns
  const campaigns = await repository.getCampaigns(clientId, {
    status: 'ENABLED',
    limit: 10,
  });

  // Get metrics for last 30 days
  const dateRange = {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  };

  // Get aggregated metrics for each campaign
  const campaignMetrics = await Promise.all(
    campaigns.map(async campaign => {
      const metrics = await repository.getAggregatedMetrics(
        campaign.id,
        dateRange
      );
      return {
        campaign,
        metrics,
      };
    })
  );

  // Get last sync status
  const connection = await repository.getConnection(clientId);
  const lastSync = connection?.last_sync_at;

  return {
    campaigns: campaignMetrics,
    lastSync,
    totalCampaigns: await repository.getCampaignCount(clientId),
    activeCampaigns: await repository.getCampaignCount(clientId, 'ENABLED'),
  };
}
```

## Error Handling

Always wrap repository calls in try-catch:

```typescript
try {
  const campaigns = await repository.getCampaigns(clientId);
} catch (error) {
  console.error('Failed to get campaigns:', error.message);
  // Handle error (show user message, retry, etc.)
}
```

## Performance Tips

1. **Use batch operations** for multiple records
2. **Implement pagination** for large datasets
3. **Use aggregated queries** instead of client-side calculations
4. **Cache frequently accessed data** in your application layer

## Next Steps

- Read the [full documentation](./README-google-ads-repository.md)
- Check the [database schema](../../../database/google-ads-schema.sql)
- Review the [Google Ads Client](../google/client.ts)
- Explore the [Token Manager](../google/token-manager.ts)

## Need Help?

- Check existing sync logs for debugging: `repository.getSyncLogs(connectionId)`
- Verify connection status: `repository.hasConnection(clientId)`
- Review campaign counts: `repository.getCampaignCount(clientId)`
