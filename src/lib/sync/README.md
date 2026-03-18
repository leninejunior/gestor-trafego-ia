# Base Sync Architecture

This module provides the foundation for syncing campaign data from multiple advertising platforms (Meta Ads, Google Ads) into a historical data cache.

## Components

### 1. Types (`src/lib/types/sync.ts`)

Core TypeScript types and interfaces:

- **AdPlatform**: Enum for supported platforms (META, GOOGLE)
- **SyncConfig**: Configuration for platform connections
- **CampaignInsight**: Universal data structure for campaign metrics
- **DataQuery**: Query parameters for retrieving cached data
- **Campaign**: Basic campaign information
- **SyncResult**: Result of sync operations
- **StorageStats**: Storage usage statistics

### 2. BaseSyncAdapter (`src/lib/sync/base-sync-adapter.ts`)

Abstract base class that all platform-specific adapters must extend:

**Abstract Methods** (must be implemented by subclasses):
- `authenticate()`: Platform-specific authentication
- `fetchCampaigns()`: Retrieve campaigns from platform
- `fetchInsights()`: Retrieve campaign insights/metrics
- `normalizePlatformData()`: Convert platform data to universal format

**Provided Methods**:
- `validateConnection()`: Test if credentials work
- `calculateMetrics()`: Calculate CTR, CPC, CPM, conversion rate
- `refreshAccessToken()`: Handle token refresh logic
- `handleError()`: Standardized error handling
- `getRateLimitDelay()`: Platform-specific rate limiting
- `sleep()`: Utility for rate limiting

### 3. HistoricalDataRepository (`src/lib/repositories/historical-data-repository.ts`)

Repository for managing cached campaign data in Supabase:

**Methods**:
- `storeInsights()`: Batch insert/upsert campaign insights
- `queryInsights()`: Query cached data with filters
- `deleteExpiredData()`: Remove data beyond retention period
- `getStorageStats()`: Get storage usage statistics
- `hasDataForRange()`: Check if data exists for date range
- `getCampaignIds()`: Get unique campaign IDs for a client

## Usage Example

```typescript
import { BaseSyncAdapter } from '@/lib/sync/base-sync-adapter';
import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { AdPlatform, CampaignInsight } from '@/lib/types/sync';

// 1. Create platform-specific adapter (Meta or Google)
class MetaAdsSyncAdapter extends BaseSyncAdapter {
  readonly platform = AdPlatform.META;
  
  async authenticate(credentials) {
    // Meta-specific auth logic
  }
  
  async fetchCampaigns(accountId) {
    // Fetch from Meta API
  }
  
  async fetchInsights(campaignId, dateRange) {
    // Fetch insights from Meta API
    const rawData = await metaApi.getInsights(campaignId, dateRange);
    return rawData.map(d => this.calculateMetrics(this.normalizePlatformData(d)));
  }
  
  protected normalizePlatformData(platformData) {
    // Convert Meta format to universal format
    return {
      id: platformData.id,
      platform: AdPlatform.META,
      // ... map other fields
    };
  }
}

// 2. Use adapter to sync data
const adapter = new MetaAdsSyncAdapter(syncConfig);
await adapter.authenticate({ access_token: 'xxx' });
const campaigns = await adapter.fetchCampaigns('account_123');
const insights = await adapter.fetchInsights('campaign_456', { start, end });

// 3. Store in cache
const repository = new HistoricalDataRepository();
await repository.storeInsights(insights);

// 4. Query cached data
const cachedData = await repository.queryInsights({
  client_id: 'client_123',
  platform: AdPlatform.META,
  date_from: new Date('2025-01-01'),
  date_to: new Date('2025-01-31')
});
```

## Next Steps

The following tasks will build on this foundation:

- **Task 5**: Implement MetaAdsSyncAdapter
- **Task 6**: Implement GoogleAdsSyncAdapter  
- **Task 7**: Create MultiPlatformSyncEngine to orchestrate syncs
- **Task 8**: Implement HybridDataService for cache + real-time API

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Req 4.1, 4.2, 4.3**: Base sync architecture with error handling
- **Req 5.1, 5.2**: Universal data format and platform abstraction
- **Req 6.1**: Query interface for cached data
- **Req 2.3**: Data retention and cleanup support
- **Req 10.1**: Storage statistics and monitoring
